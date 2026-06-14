from os import getenv

from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    abs as spark_abs,
    avg,
    col,
    concat,
    count,
    current_timestamp,
    from_json,
    greatest,
    lit,
    max as spark_max,
    round as spark_round,
    sum as spark_sum,
    to_date,
    to_timestamp,
    unix_millis,
    when,
    window,
)
from pyspark.sql.types import DoubleType, IntegerType, StringType, StructField, StructType
from pyspark.sql.window import Window
from pyspark.sql.functions import row_number


KAFKA_BOOTSTRAP_SERVERS = getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
KAFKA_TOPIC = getenv("KAFKA_TOPIC", "air-quality-readings")
CASSANDRA_KEYSPACE = getenv("CASSANDRA_KEYSPACE", "iot_air_quality")
CHECKPOINT_DIR = getenv(
    "SPARK_CHECKPOINT_DIR",
    "/tmp/spark-checkpoints/air-quality-readings",
)


reading_schema = StructType(
    [
        StructField("deviceId", StringType(), False),
        StructField("locationId", StringType(), False),
        StructField("timestamp", StringType(), False),
        StructField("pm25", DoubleType(), False),
        StructField("pm10", DoubleType(), False),
        StructField("co2", DoubleType(), False),
        StructField("temperature", DoubleType(), False),
        StructField("humidity", DoubleType(), False),
        StructField("aqi", IntegerType(), False),
    ]
)


def main():
    spark = (
        SparkSession.builder.appName("air-quality-stream")
        .config("spark.cassandra.connection.host", "cassandra")
        .config("spark.cassandra.connection.port", "9042")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    kafka_stream = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP_SERVERS)
        .option("subscribe", KAFKA_TOPIC)
        .option("startingOffsets", "latest")
        .load()
    )

    readings = (
        kafka_stream.selectExpr("CAST(value AS STRING) AS json_value")
        .select(from_json(col("json_value"), reading_schema).alias("reading"))
        .select("reading.*")
        .withColumn("ts", to_timestamp(col("timestamp")))
        .withColumn("day", to_date(col("ts")))
        .select(
            col("deviceId").alias("device_id"),
            col("locationId").alias("location_id"),
            "day",
            "ts",
            "pm25",
            "pm10",
            "co2",
            "temperature",
            "humidity",
            "aqi",
        )
        .filter(
            col("device_id").isNotNull()
            & col("location_id").isNotNull()
            & col("ts").isNotNull()
            & col("day").isNotNull()
        )
        .withColumn(
            "quality_status",
            when(
                col("pm25").between(0, 500)
                & col("pm10").between(0, 600)
                & col("co2").between(250, 10000)
                & col("temperature").between(-50, 70)
                & col("humidity").between(0, 100)
                & col("aqi").between(0, 500),
                lit("VALID"),
            ).otherwise(lit("INVALID")),
        )
        .withColumn(
            "anomaly_score",
            spark_round(
                greatest(
                    spark_abs(col("pm25") - lit(12.0)) / lit(35.0),
                    spark_abs(col("pm10") - lit(25.0)) / lit(80.0),
                    spark_abs(col("co2") - lit(420.0)) / lit(800.0),
                    spark_abs(col("temperature") - lit(20.0)) / lit(20.0),
                    spark_abs(col("humidity") - lit(50.0)) / lit(35.0),
                ),
                3,
            ),
        )
        .withColumn(
            "alert_level",
            when(col("quality_status") == "INVALID", lit("DATA_QUALITY"))
            .when((col("aqi") >= 151) | (col("co2") >= 2000), lit("CRITICAL"))
            .when(
                (col("aqi") >= 101)
                | (col("co2") >= 1200)
                | (col("anomaly_score") >= 2.5),
                lit("WARNING"),
            )
            .otherwise(lit("NORMAL")),
        )
        .withColumn("processed_at", current_timestamp())
        .withColumn(
            "processing_latency_ms",
            greatest(unix_millis(col("processed_at")) - unix_millis(col("ts")), lit(0)),
        )
    )

    valid_readings = readings.filter(col("quality_status") == "VALID")

    readings_query = (
        readings.writeStream.foreachBatch(write_to_cassandra)
        .option("checkpointLocation", CHECKPOINT_DIR)
        .start()
    )

    aggregates = (
        valid_readings.withWatermark("ts", "2 minutes")
        .groupBy(
            col("device_id"),
            col("location_id"),
            window(col("ts"), "1 minute", "10 seconds"),
        )
        .agg(
            count(lit(1)).alias("sample_count"),
            avg("pm25").alias("avg_pm25"),
            avg("pm10").alias("avg_pm10"),
            avg("co2").alias("avg_co2"),
            avg("temperature").alias("avg_temperature"),
            avg("humidity").alias("avg_humidity"),
            avg("aqi").alias("avg_aqi"),
            spark_max("aqi").alias("max_aqi"),
        )
        .select(
            "device_id",
            to_date(col("window.start")).alias("day"),
            col("window.start").alias("window_start"),
            col("window.end").alias("window_end"),
            "location_id",
            "sample_count",
            "avg_pm25",
            "avg_pm10",
            "avg_co2",
            "avg_temperature",
            "avg_humidity",
            "avg_aqi",
            "max_aqi",
        )
    )

    aggregates_query = (
        aggregates.writeStream.outputMode("update")
        .foreachBatch(write_aggregates)
        .option("checkpointLocation", f"{CHECKPOINT_DIR}-aggregates")
        .start()
    )

    readings_query.awaitTermination()
    aggregates_query.awaitTermination()


def write_to_cassandra(batch_df, batch_id):
    if batch_df.rdd.isEmpty():
        return

    valid_batch_df = batch_df.filter(col("quality_status") == "VALID")

    raw_device_df = valid_batch_df.select(
        "device_id",
        "day",
        "ts",
        "location_id",
        "pm25",
        "pm10",
        "co2",
        "temperature",
        "humidity",
        "aqi",
        "anomaly_score",
        "alert_level",
        "quality_status",
        "processed_at",
        "processing_latency_ms",
    )

    raw_location_df = valid_batch_df.select(
        "location_id",
        "day",
        "ts",
        "device_id",
        "pm25",
        "pm10",
        "co2",
        "temperature",
        "humidity",
        "aqi",
        "anomaly_score",
        "alert_level",
        "quality_status",
        "processed_at",
        "processing_latency_ms",
    )

    latest_window = Window.partitionBy("device_id").orderBy(col("ts").desc())
    latest_df = (
        valid_batch_df.withColumn("row_number", row_number().over(latest_window))
        .filter(col("row_number") == 1)
        .drop("row_number")
        .select(
            "device_id",
            "location_id",
            "ts",
            "pm25",
            "pm10",
            "co2",
            "temperature",
            "humidity",
            "aqi",
            "anomaly_score",
            "alert_level",
            "quality_status",
            "processed_at",
            "processing_latency_ms",
        )
    )

    write_table(raw_device_df, "readings_by_device_day")
    write_table(raw_location_df, "readings_by_location_day")
    write_table(latest_df, "latest_reading_by_device")
    write_table(
        latest_df.select(
            "device_id",
            col("ts").alias("last_seen_at"),
            col("processed_at").alias("updated_at"),
        ),
        "sensor_metadata_by_id",
    )

    alerts_df = (
        valid_batch_df.filter(col("alert_level").isin("WARNING", "CRITICAL"))
        .withColumn("alert_type", lit("AIR_QUALITY"))
        .withColumn(
            "message",
            concat(
                lit("Air quality "),
                col("alert_level"),
                lit(": AQI "),
                col("aqi"),
                lit(", CO2 "),
                col("co2"),
                lit(" ppm"),
            ),
        )
        .withColumn("metric", lit("AQI"))
        .withColumn("metric_value", col("aqi").cast("double"))
        .withColumn(
            "threshold",
            when(col("alert_level") == "CRITICAL", lit(151.0)).otherwise(lit(101.0)),
        )
        .select(
            "device_id",
            "day",
            "ts",
            "location_id",
            "alert_level",
            "alert_type",
            "message",
            "metric",
            "metric_value",
            "threshold",
            "anomaly_score",
        )
    )
    write_table(alerts_df, "alerts_by_device_day")

    batch_metrics = batch_df.agg(
        count(lit(1)).alias("records_processed"),
        spark_sum(when(col("quality_status") == "INVALID", lit(1)).otherwise(lit(0))).alias(
            "invalid_records"
        ),
        count(when(col("alert_level").isin("WARNING", "CRITICAL"), lit(1))).alias(
            "alerts_generated"
        ),
        avg("processing_latency_ms").alias("avg_latency_ms"),
        spark_max("processing_latency_ms").alias("max_latency_ms"),
    ).select(
        lit("latest").alias("metric_id"),
        current_timestamp().alias("updated_at"),
        lit(batch_id).cast("long").alias("batch_id"),
        "records_processed",
        "invalid_records",
        "alerts_generated",
        "avg_latency_ms",
        "max_latency_ms",
    )
    write_table(batch_metrics, "pipeline_metrics")


def write_aggregates(batch_df, _batch_id):
    if batch_df.rdd.isEmpty():
        return

    write_table(batch_df, "aggregates_by_device_day")


def write_table(data_frame, table):
    (
        data_frame.write.format("org.apache.spark.sql.cassandra")
        .mode("append")
        .options(keyspace=CASSANDRA_KEYSPACE, table=table)
        .save()
    )


if __name__ == "__main__":
    main()

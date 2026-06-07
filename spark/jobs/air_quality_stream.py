from os import getenv

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, from_json, to_date, to_timestamp
from pyspark.sql.types import DoubleType, IntegerType, StringType, StructField, StructType


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
    )

    query = (
        readings.writeStream.foreachBatch(write_to_cassandra)
        .option("checkpointLocation", CHECKPOINT_DIR)
        .start()
    )

    query.awaitTermination()


def write_to_cassandra(batch_df, _batch_id):
    if batch_df.rdd.isEmpty():
        return

    raw_device_df = batch_df.select(
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
    )

    raw_location_df = batch_df.select(
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
    )

    latest_df = batch_df.select(
        "device_id",
        "location_id",
        "ts",
        "pm25",
        "pm10",
        "co2",
        "temperature",
        "humidity",
        "aqi",
    )

    write_table(raw_device_df, "readings_by_device_day")
    write_table(raw_location_df, "readings_by_location_day")
    write_table(latest_df, "latest_reading_by_device")


def write_table(data_frame, table):
    (
        data_frame.write.format("org.apache.spark.sql.cassandra")
        .mode("append")
        .options(keyspace=CASSANDRA_KEYSPACE, table=table)
        .save()
    )


if __name__ == "__main__":
    main()

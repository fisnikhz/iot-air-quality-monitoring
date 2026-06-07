import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  create(data: { name: string; email: string; passwordHash: string }) {
    return this.userModel.create(data);
  }

  findById(id: string) {
    return this.userModel.findById(id).exec();
  }
}

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from '../../entities/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findOne({ email: dto.email }).exec();
    if (existing) throw new ConflictException('El email ya está registrado');

    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash: await bcrypt.hash(dto.password, 10),
      role: UserRole.CUSTOMER,
    });
    return this.buildToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ email: dto.email }).exec();
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.buildToken(user);
  }

  private buildToken(user: UserDocument) {
    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}

import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsDateString()
  startsAt!: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsDateString()
  registrationOpensAt!: string;

  @IsDateString()
  registrationClosesAt!: string;
}

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  email!: string;
}

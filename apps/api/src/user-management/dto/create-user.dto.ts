import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(1024)
  password!: string;
}

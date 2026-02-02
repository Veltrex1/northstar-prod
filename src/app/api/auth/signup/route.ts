import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { hash } from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2),
  industry: z.string().min(2),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, companyName, industry } = signupSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return errorResponse("USER_EXISTS", "User with this email already exists", 400);
    }

    const passwordHash = await hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          industry,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          companyId: company.id,
          role: "OWNER",
        },
      });

      return { company, user };
    });

    const token = jwt.sign(
      { userId: result.user.id, companyId: result.company.id },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const response = successResponse(
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          companyId: result.user.companyId,
        },
        token,
      },
      201
    );

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("VALIDATION_ERROR", error.errors[0].message, 400);
    }
    return errorResponse("SIGNUP_ERROR", "Failed to create account", 500);
  }
}

const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();

const TEST_ACCOUNT = {
  name: process.env.TEST_ACCOUNT_NAME || "Test User",
  email: process.env.TEST_ACCOUNT_EMAIL || "hello@veltrex.ai",
  password: process.env.TEST_ACCOUNT_PASSWORD,
  companyName: process.env.TEST_ACCOUNT_COMPANY || "Veltrex",
  industry: process.env.TEST_ACCOUNT_INDUSTRY || "Technology",
  role: process.env.TEST_ACCOUNT_ROLE || "OWNER",
};

async function main() {
  const existingUser = await prisma.user.findUnique({
    where: { email: TEST_ACCOUNT.email },
  });

  if (!TEST_ACCOUNT.password) {
    throw new Error("TEST_ACCOUNT_PASSWORD is required");
  }

  const passwordHash = await hash(TEST_ACCOUNT.password, 10);

  if (existingUser) {
    await prisma.user.update({
      where: { email: TEST_ACCOUNT.email },
      data: {
        name: TEST_ACCOUNT.name,
        passwordHash,
        role: TEST_ACCOUNT.role,
      },
    });

    console.log("Updated existing test account:", TEST_ACCOUNT.email);
    return;
  }

  const company = await prisma.company.create({
    data: {
      name: TEST_ACCOUNT.companyName,
      industry: TEST_ACCOUNT.industry,
    },
  });

  await prisma.user.create({
    data: {
      name: TEST_ACCOUNT.name,
      email: TEST_ACCOUNT.email,
      passwordHash,
      role: TEST_ACCOUNT.role,
      companyId: company.id,
    },
  });

  console.log("Created test account:", TEST_ACCOUNT.email);
}

main()
  .catch((error) => {
    console.error("Failed to create test account:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

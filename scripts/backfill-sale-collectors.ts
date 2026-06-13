// Backfills Sale.collectedByUserId for any legacy rows where it is NULL.
// Required before the schema can be tightened to NOT NULL (see README).
//
// Usage:
//   npx tsx scripts/backfill-sale-collectors.ts <userId>
//
// Pick the user that historical "uncollected" sales should be attributed to
// (e.g. the Caja user). Idempotent: skips rows that already have a collector.

import { prisma } from '../app/lib/prisma';

async function main() {
  const targetUserId = process.argv[2];
  if (!targetUserId) {
    console.error('Usage: npx tsx scripts/backfill-sale-collectors.ts <userId>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    console.error(`User ${targetUserId} not found`);
    process.exit(1);
  }
  console.log(`Attributing uncollected sales to ${user.alias}`);

  const result = await prisma.sale.updateMany({
    where: { collectedByUserId: null },
    data: { collectedByUserId: targetUserId },
  });

  console.log(`Updated ${result.count} sales.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

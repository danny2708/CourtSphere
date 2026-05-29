import {
  AccountStatus,
  BookingPermissionStatus,
  BookingStatus,
  CourtStatus,
  EntityStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
  PrismaClient,
  RefundStatus,
  ViolationType,
  WaitlistStatus
} from "@prisma/client";

import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const seedPassword = "Password123!";

function seedUuid(sequence: number): string {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function atLocalTime(dayOffset: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

const courtIds = {
  footballA: seedUuid(101),
  badmintonA: seedUuid(102),
  basketballA: seedUuid(103),
  footballB: seedUuid(104),
  badmintonB: seedUuid(105),
  tennisA: seedUuid(106),
  volleyballA: seedUuid(107),
  multipurposeA: seedUuid(108),
  gymA: seedUuid(109)
};

const pricingRuleIds = {
  footballAMorning: seedUuid(201),
  footballAEvening: seedUuid(202),
  badmintonAMorning: seedUuid(203),
  badmintonAEvening: seedUuid(204),
  basketballAMorning: seedUuid(205),
  basketballAEvening: seedUuid(206),
  footballBMorning: seedUuid(207),
  footballBEvening: seedUuid(208),
  badmintonBDefault: seedUuid(209),
  tennisADefault: seedUuid(210),
  volleyballADefault: seedUuid(211),
  multipurposeADefault: seedUuid(212),
  gymADefault: seedUuid(213)
};

const legacyCourtIds = {
  footballA: "00000000-0000-0000-0000-000000000101",
  badmintonA: "00000000-0000-0000-0000-000000000102",
  basketballA: "00000000-0000-0000-0000-000000000103"
};

const legacyPricingRuleIds = {
  footballDefault: "00000000-0000-0000-0000-000000000201",
  badmintonDefault: "00000000-0000-0000-0000-000000000202",
  basketballDefault: "00000000-0000-0000-0000-000000000203"
};

const bookingOrderIds = {
  completed: seedUuid(301),
  confirmedFuture: seedUuid(302),
  pendingHold: seedUuid(303),
  paymentProcessing: seedUuid(304),
  paymentExpired: seedUuid(305),
  userCancelledOnTime: seedUuid(306),
  lateCancelled: seedUuid(307),
  managerCancelled: seedUuid(308),
  noShow: seedUuid(309),
  checkinExpired: seedUuid(310),
  inUse: seedUuid(311),
  managerConfirmedToday: seedUuid(312),
  comboConfirmed: seedUuid(313)
};

const bookingItemIds = {
  completed: seedUuid(401),
  confirmedFuture: seedUuid(402),
  pendingHold: seedUuid(403),
  paymentProcessing: seedUuid(404),
  paymentExpired: seedUuid(405),
  userCancelledOnTime: seedUuid(406),
  lateCancelled: seedUuid(407),
  managerCancelled: seedUuid(408),
  noShow: seedUuid(409),
  checkinExpired: seedUuid(410),
  inUse: seedUuid(411),
  managerConfirmedToday: seedUuid(412),
  comboFootball: seedUuid(413),
  comboBadminton: seedUuid(414)
};

const paymentIds = {
  completed: seedUuid(501),
  confirmedFuture: seedUuid(502),
  pendingHold: seedUuid(503),
  paymentProcessing: seedUuid(504),
  paymentExpired: seedUuid(505),
  userCancelledOnTime: seedUuid(506),
  lateCancelled: seedUuid(507),
  managerCancelled: seedUuid(508),
  noShow: seedUuid(509),
  checkinExpired: seedUuid(510),
  inUse: seedUuid(511),
  managerConfirmedToday: seedUuid(512),
  comboConfirmed: seedUuid(513)
};

const refundIds = {
  userCancelledOnTime: seedUuid(601),
  managerCancelled: seedUuid(602)
};

const waitlistIds = {
  waitingForConfirmedSlot: seedUuid(701),
  notifiedReadyToBook: seedUuid(702),
  expired: seedUuid(703),
  booked: seedUuid(704)
};

const violationIds = {
  lateCancel: seedUuid(801),
  noShow: seedUuid(802)
};

const courtStatusHistoryIds = {
  volleyballClosed: seedUuid(901),
  gymMaintenance: seedUuid(902)
};

const auditLogIds = {
  bookingRuleUpdated: seedUuid(1001),
  managerCancel: seedUuid(1002),
  noShowMarked: seedUuid(1003),
  lateCancelViolation: seedUuid(1004),
  courtMaintenance: seedUuid(1005)
};

async function migrateLegacySeedIds() {
  const courtIdPairs = [
    [legacyCourtIds.footballA, courtIds.footballA],
    [legacyCourtIds.badmintonA, courtIds.badmintonA],
    [legacyCourtIds.basketballA, courtIds.basketballA]
  ] as const;

  const pricingRuleIdPairs = [
    [legacyPricingRuleIds.footballDefault, pricingRuleIds.footballAMorning],
    [legacyPricingRuleIds.badmintonDefault, pricingRuleIds.badmintonAMorning],
    [legacyPricingRuleIds.basketballDefault, pricingRuleIds.basketballAMorning]
  ] as const;

  for (const [legacyId, nextId] of courtIdPairs) {
    const [legacyCourt, nextCourt] = await Promise.all([
      prisma.court.findUnique({ where: { courtId: legacyId }, select: { courtId: true } }),
      prisma.court.findUnique({ where: { courtId: nextId }, select: { courtId: true } })
    ]);

    if (legacyCourt && !nextCourt) {
      await prisma.court.update({
        where: { courtId: legacyId },
        data: { courtId: nextId }
      });
    }
  }

  for (const [legacyId, nextId] of pricingRuleIdPairs) {
    const [legacyPricingRule, nextPricingRule] = await Promise.all([
      prisma.pricingRule.findUnique({ where: { pricingRuleId: legacyId }, select: { pricingRuleId: true } }),
      prisma.pricingRule.findUnique({ where: { pricingRuleId: nextId }, select: { pricingRuleId: true } })
    ]);

    if (legacyPricingRule && !nextPricingRule) {
      await prisma.pricingRule.update({
        where: { pricingRuleId: legacyId },
        data: { pricingRuleId: nextId }
      });
    }
  }
}

async function seedPriorityGroups() {
  const [staff, student, external] = await Promise.all([
    prisma.priorityGroup.upsert({
      where: { groupCode: "STAFF" },
      update: {
        groupName: "Staff",
        priorityLevel: 1,
        advanceBookingDays: 14,
        description: "Can bo/Giang vien",
        status: EntityStatus.ACTIVE
      },
      create: {
        groupCode: "STAFF",
        groupName: "Staff",
        priorityLevel: 1,
        advanceBookingDays: 14,
        description: "Can bo/Giang vien"
      }
    }),
    prisma.priorityGroup.upsert({
      where: { groupCode: "STUDENT" },
      update: {
        groupName: "Student",
        priorityLevel: 2,
        advanceBookingDays: 7,
        description: "Sinh vien",
        status: EntityStatus.ACTIVE
      },
      create: {
        groupCode: "STUDENT",
        groupName: "Student",
        priorityLevel: 2,
        advanceBookingDays: 7,
        description: "Sinh vien"
      }
    }),
    prisma.priorityGroup.upsert({
      where: { groupCode: "EXTERNAL" },
      update: {
        groupName: "External",
        priorityLevel: 3,
        advanceBookingDays: 3,
        description: "Khach ngoai truong",
        status: EntityStatus.ACTIVE
      },
      create: {
        groupCode: "EXTERNAL",
        groupName: "External",
        priorityLevel: 3,
        advanceBookingDays: 3,
        description: "Khach ngoai truong"
      }
    })
  ]);

  return { staff, student, external };
}

async function seedRoles() {
  const [user, fieldManager, admin] = await Promise.all([
    prisma.role.upsert({
      where: { roleName: "USER" },
      update: { description: "Nguoi dat san" },
      create: { roleName: "USER", description: "Nguoi dat san" }
    }),
    prisma.role.upsert({
      where: { roleName: "FIELD_MANAGER" },
      update: { description: "Ban quan ly san" },
      create: { roleName: "FIELD_MANAGER", description: "Ban quan ly san" }
    }),
    prisma.role.upsert({
      where: { roleName: "ADMIN" },
      update: { description: "Quan tri vien he thong" },
      create: { roleName: "ADMIN", description: "Quan tri vien he thong" }
    })
  ]);

  return { user, fieldManager, admin };
}

async function assignRole(userId: string, roleId: string) {
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId
      }
    },
    update: {},
    create: {
      userId,
      roleId
    }
  });
}

async function seedUsers(
  priorityGroups: Awaited<ReturnType<typeof seedPriorityGroups>>,
  passwordHash: string
) {
  const restrictedUntil = addDays(new Date(), 7);
  const [adminUser, managerUser, sampleUser, staffUser, externalUser, lateUser, restrictedUser] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@courtsphere.local" },
      update: {
        fullName: "CourtSphere Admin",
        phoneNumber: "0910000001",
        passwordHash,
        identityCode: "CS-SEED-ADMIN-001",
        accountStatus: AccountStatus.ACTIVE,
        bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
        bookingLockedUntil: null,
        violationPoints: 0,
        priorityGroupId: priorityGroups.staff.priorityGroupId
      },
      create: {
        fullName: "CourtSphere Admin",
        email: "admin@courtsphere.local",
        phoneNumber: "0910000001",
        passwordHash,
        identityCode: "CS-SEED-ADMIN-001",
        priorityGroupId: priorityGroups.staff.priorityGroupId
      }
    }),
    prisma.user.upsert({
      where: { email: "manager@courtsphere.local" },
      update: {
        fullName: "Field Manager",
        phoneNumber: "0910000002",
        passwordHash,
        identityCode: "CS-SEED-MANAGER-001",
        accountStatus: AccountStatus.ACTIVE,
        bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
        bookingLockedUntil: null,
        violationPoints: 0,
        priorityGroupId: priorityGroups.staff.priorityGroupId
      },
      create: {
        fullName: "Field Manager",
        email: "manager@courtsphere.local",
        phoneNumber: "0910000002",
        passwordHash,
        identityCode: "CS-SEED-MANAGER-001",
        priorityGroupId: priorityGroups.staff.priorityGroupId
      }
    }),
    prisma.user.upsert({
      where: { email: "user@courtsphere.local" },
      update: {
        fullName: "Sample Student",
        phoneNumber: "0910000003",
        passwordHash,
        identityCode: "CS-SEED-STUDENT-001",
        accountStatus: AccountStatus.ACTIVE,
        bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
        bookingLockedUntil: null,
        violationPoints: 0,
        priorityGroupId: priorityGroups.student.priorityGroupId
      },
      create: {
        fullName: "Sample Student",
        email: "user@courtsphere.local",
        phoneNumber: "0910000003",
        passwordHash,
        identityCode: "CS-SEED-STUDENT-001",
        priorityGroupId: priorityGroups.student.priorityGroupId
      }
    }),
    prisma.user.upsert({
      where: { email: "staff@courtsphere.local" },
      update: {
        fullName: "Staff User",
        phoneNumber: "0910000004",
        passwordHash,
        identityCode: "CS-SEED-STAFF-001",
        accountStatus: AccountStatus.ACTIVE,
        bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
        bookingLockedUntil: null,
        violationPoints: 0,
        priorityGroupId: priorityGroups.staff.priorityGroupId
      },
      create: {
        fullName: "Staff User",
        email: "staff@courtsphere.local",
        phoneNumber: "0910000004",
        passwordHash,
        identityCode: "CS-SEED-STAFF-001",
        priorityGroupId: priorityGroups.staff.priorityGroupId
      }
    }),
    prisma.user.upsert({
      where: { email: "external@courtsphere.local" },
      update: {
        fullName: "External Guest",
        phoneNumber: "0910000005",
        passwordHash,
        identityCode: "CS-SEED-EXTERNAL-001",
        accountStatus: AccountStatus.ACTIVE,
        bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
        bookingLockedUntil: null,
        violationPoints: 0,
        priorityGroupId: priorityGroups.external.priorityGroupId
      },
      create: {
        fullName: "External Guest",
        email: "external@courtsphere.local",
        phoneNumber: "0910000005",
        passwordHash,
        identityCode: "CS-SEED-EXTERNAL-001",
        priorityGroupId: priorityGroups.external.priorityGroupId
      }
    }),
    prisma.user.upsert({
      where: { email: "late.user@courtsphere.local" },
      update: {
        fullName: "Late Cancellation User",
        phoneNumber: "0910000006",
        passwordHash,
        identityCode: "CS-SEED-STUDENT-002",
        accountStatus: AccountStatus.ACTIVE,
        bookingPermissionStatus: BookingPermissionStatus.ALLOWED,
        bookingLockedUntil: null,
        violationPoints: 1,
        priorityGroupId: priorityGroups.student.priorityGroupId
      },
      create: {
        fullName: "Late Cancellation User",
        email: "late.user@courtsphere.local",
        phoneNumber: "0910000006",
        passwordHash,
        identityCode: "CS-SEED-STUDENT-002",
        priorityGroupId: priorityGroups.student.priorityGroupId,
        violationPoints: 1
      }
    }),
    prisma.user.upsert({
      where: { email: "restricted@courtsphere.local" },
      update: {
        fullName: "Restricted Student",
        phoneNumber: "0910000007",
        passwordHash,
        identityCode: "CS-SEED-STUDENT-003",
        accountStatus: AccountStatus.ACTIVE,
        bookingPermissionStatus: BookingPermissionStatus.RESTRICTED,
        bookingLockedUntil: restrictedUntil,
        violationPoints: 3,
        priorityGroupId: priorityGroups.student.priorityGroupId
      },
      create: {
        fullName: "Restricted Student",
        email: "restricted@courtsphere.local",
        phoneNumber: "0910000007",
        passwordHash,
        identityCode: "CS-SEED-STUDENT-003",
        priorityGroupId: priorityGroups.student.priorityGroupId,
        bookingPermissionStatus: BookingPermissionStatus.RESTRICTED,
        bookingLockedUntil: restrictedUntil,
        violationPoints: 3
      }
    })
  ]);

  return { adminUser, managerUser, sampleUser, staffUser, externalUser, lateUser, restrictedUser };
}

async function seedCourtTypes() {
  const definitions = [
    { key: "football", typeName: "Bong da", description: "San bong da ngoai troi" },
    { key: "basketball", typeName: "Bong ro", description: "San bong ro tieu chuan" },
    { key: "badminton", typeName: "Cau long", description: "San cau long trong nha" },
    { key: "tennis", typeName: "Tennis", description: "San tennis luyen tap" },
    { key: "volleyball", typeName: "Bong chuyen", description: "San bong chuyen da nang" },
    { key: "gym", typeName: "Phong gym", description: "Phong tap the luc" },
    { key: "multipurpose", typeName: "Da nang", description: "Khu thi dau da nang" }
  ] as const;

  const courtTypes = await Promise.all(
    definitions.map((definition) =>
      prisma.courtType.upsert({
        where: { typeName: definition.typeName },
        update: {
          description: definition.description,
          status: EntityStatus.ACTIVE
        },
        create: {
          typeName: definition.typeName,
          description: definition.description
        }
      })
    )
  );

  return {
    football: courtTypes[0],
    basketball: courtTypes[1],
    badminton: courtTypes[2],
    tennis: courtTypes[3],
    volleyball: courtTypes[4],
    gym: courtTypes[5],
    multipurpose: courtTypes[6]
  };
}

async function seedCourts(courtTypes: Awaited<ReturnType<typeof seedCourtTypes>>) {
  const definitions = [
    {
      courtId: courtIds.footballA,
      courtName: "San bong da A",
      courtTypeId: courtTypes.football.courtTypeId,
      description: "San bong da 7 nguoi co den chieu sang, phu hop giai dau noi bo.",
      imageUrl: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80",
      status: CourtStatus.ACTIVE
    },
    {
      courtId: courtIds.badmintonA,
      courtName: "San cau long A",
      courtTypeId: courtTypes.badminton.courtTypeId,
      description: "San cau long trong nha, mat san go va co khu cho.",
      imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80",
      status: CourtStatus.ACTIVE
    },
    {
      courtId: courtIds.basketballA,
      courtName: "San bong ro A",
      courtTypeId: courtTypes.basketball.courtTypeId,
      description: "San bong ro tieu chuan, san ngoai troi co khan dai nho.",
      imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80",
      status: CourtStatus.ACTIVE
    },
    {
      courtId: courtIds.footballB,
      courtName: "San bong da B",
      courtTypeId: courtTypes.football.courtTypeId,
      description: "San co nhan tao phuc vu cau lac bo va lich hoc giao duc the chat.",
      imageUrl: "https://images.unsplash.com/photo-1556056504-5c7696c4c28d?auto=format&fit=crop&w=1200&q=80",
      status: CourtStatus.ACTIVE
    },
    {
      courtId: courtIds.badmintonB,
      courtName: "San cau long B",
      courtTypeId: courtTypes.badminton.courtTypeId,
      description: "San cau long phu cho lich tap buoi toi.",
      imageUrl: "https://images.unsplash.com/photo-1613918431703-aa50889e3be8?auto=format&fit=crop&w=1200&q=80",
      status: CourtStatus.ACTIVE
    },
    {
      courtId: courtIds.tennisA,
      courtName: "San tennis A",
      courtTypeId: courtTypes.tennis.courtTypeId,
      description: "San tennis ngoai troi phu hop luyen tap ca nhan.",
      imageUrl: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=80",
      status: CourtStatus.ACTIVE
    },
    {
      courtId: courtIds.volleyballA,
      courtName: "San bong chuyen A",
      courtTypeId: courtTypes.volleyball.courtTypeId,
      description: "San bong chuyen dang tam dong de bao duong mat san.",
      imageUrl: "https://images.unsplash.com/photo-1592656094267-764a45160876?auto=format&fit=crop&w=1200&q=80",
      status: CourtStatus.TEMP_CLOSED
    },
    {
      courtId: courtIds.multipurposeA,
      courtName: "Nha thi dau da nang",
      courtTypeId: courtTypes.multipurpose.courtTypeId,
      description: "Khong gian trong nha phuc vu giai dau va su kien the thao.",
      imageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
      status: CourtStatus.ACTIVE
    },
    {
      courtId: courtIds.gymA,
      courtName: "Phong gym A",
      courtTypeId: courtTypes.gym.courtTypeId,
      description: "Phong gym dang bao tri thiet bi dinh ky.",
      imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
      status: CourtStatus.MAINTENANCE
    }
  ];

  const courts = await Promise.all(
    definitions.map((definition) =>
      prisma.court.upsert({
        where: { courtId: definition.courtId },
        update: {
          courtName: definition.courtName,
          courtTypeId: definition.courtTypeId,
          description: definition.description,
          imageUrl: definition.imageUrl,
          status: definition.status
        },
        create: definition
      })
    )
  );

  return {
    footballA: courts[0],
    badmintonA: courts[1],
    basketballA: courts[2],
    footballB: courts[3],
    badmintonB: courts[4],
    tennisA: courts[5],
    volleyballA: courts[6],
    multipurposeA: courts[7],
    gymA: courts[8]
  };
}

async function seedOperatingHours(courtId: string, input: {
  weekdayOpenTime?: string;
  weekdayCloseTime?: string;
  weekendOpenTime?: string;
  weekendCloseTime?: string;
  slotDurationMinutes?: number;
} = {}) {
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const isWeekend = weekday === 6 || weekday === 7;
    await prisma.operatingHour.upsert({
      where: {
        courtId_weekday: {
          courtId,
          weekday
        }
      },
      update: {
        openTime: isWeekend ? input.weekendOpenTime ?? "07:00" : input.weekdayOpenTime ?? "06:00",
        closeTime: isWeekend ? input.weekendCloseTime ?? "21:00" : input.weekdayCloseTime ?? "22:00",
        slotDurationMinutes: input.slotDurationMinutes ?? 60,
        status: EntityStatus.ACTIVE
      },
      create: {
        courtId,
        weekday,
        openTime: isWeekend ? input.weekendOpenTime ?? "07:00" : input.weekdayOpenTime ?? "06:00",
        closeTime: isWeekend ? input.weekendCloseTime ?? "21:00" : input.weekdayCloseTime ?? "22:00",
        slotDurationMinutes: input.slotDurationMinutes ?? 60
      }
    });
  }
}

async function seedPricingRule(input: {
  pricingRuleId: string;
  courtId: string;
  adminUserId: string;
  startTime: string;
  endTime: string;
  priceAmount: string;
  priorityGroupId?: string;
}) {
  await prisma.pricingRule.upsert({
    where: { pricingRuleId: input.pricingRuleId },
    update: {
      courtId: input.courtId,
      createdByUserId: input.adminUserId,
      priorityGroupId: input.priorityGroupId,
      startTime: input.startTime,
      endTime: input.endTime,
      priceAmount: input.priceAmount,
      status: EntityStatus.ACTIVE
    },
    create: {
      pricingRuleId: input.pricingRuleId,
      courtId: input.courtId,
      createdByUserId: input.adminUserId,
      priorityGroupId: input.priorityGroupId,
      startTime: input.startTime,
      endTime: input.endTime,
      priceAmount: input.priceAmount
    }
  });
}

async function seedBookingRules(adminUserId: string) {
  await prisma.bookingRule.upsert({
    where: { ruleName: "DEFAULT" },
    update: {
      holdMinutes: 10,
      cancelBeforeHours: 2,
      lateCheckinMinutes: 15,
      maxBookingsPerDay: 4,
      maxDurationMinutes: 180,
      violationThreshold: 3,
      bookingBanDays: 7,
      refundRateUserOnTime: 100,
      refundRateManagerFault: 100,
      status: EntityStatus.ACTIVE,
      updatedByUserId: adminUserId
    },
    create: {
      ruleName: "DEFAULT",
      holdMinutes: 10,
      cancelBeforeHours: 2,
      lateCheckinMinutes: 15,
      maxBookingsPerDay: 4,
      maxDurationMinutes: 180,
      violationThreshold: 3,
      bookingBanDays: 7,
      refundRateUserOnTime: 100,
      refundRateManagerFault: 100,
      updatedByUserId: adminUserId
    }
  });
}

async function seedPriorityPolicies(
  priorityGroups: Awaited<ReturnType<typeof seedPriorityGroups>>,
  adminUserId: string
) {
  const policyDefinitions = [
    { group: priorityGroups.staff, priorityLevel: 1, advanceBookingDays: 14, maxBookingsPerDay: 5 },
    { group: priorityGroups.student, priorityLevel: 2, advanceBookingDays: 7, maxBookingsPerDay: 4 },
    { group: priorityGroups.external, priorityLevel: 3, advanceBookingDays: 3, maxBookingsPerDay: 2 }
  ];

  for (const definition of policyDefinitions) {
    await prisma.priorityPolicy.upsert({
      where: {
        priorityGroupId_policyName: {
          priorityGroupId: definition.group.priorityGroupId,
          policyName: "DEFAULT"
        }
      },
      update: {
        priorityLevel: definition.priorityLevel,
        advanceBookingDays: definition.advanceBookingDays,
        maxBookingsPerDay: definition.maxBookingsPerDay,
        maxDurationMinutes: 180,
        canJoinWaitlist: true,
        canBookPrioritySlots: false,
        status: EntityStatus.ACTIVE,
        updatedByUserId: adminUserId
      },
      create: {
        priorityGroupId: definition.group.priorityGroupId,
        policyName: "DEFAULT",
        priorityLevel: definition.priorityLevel,
        advanceBookingDays: definition.advanceBookingDays,
        maxBookingsPerDay: definition.maxBookingsPerDay,
        maxDurationMinutes: 180,
        canJoinWaitlist: true,
        canBookPrioritySlots: false,
        updatedByUserId: adminUserId
      }
    });
  }
}

async function seedSystemSettings(adminUserId: string) {
  const settings = [
    ["hold_minutes", "10", "Thoi gian giu slot cho thanh toan"],
    ["cancel_before_hours", "2", "So gio toi thieu de user huy dung han"],
    ["late_checkin_minutes", "15", "So phut cho truoc khi danh dau qua gio check-in"],
    ["max_bookings_per_day", "4", "So booking toi da moi ngay"],
    ["max_duration_minutes", "180", "Thoi luong booking toi da"],
    ["violation_threshold", "3", "Nguong diem vi pham de han che dat san"],
    ["booking_ban_days", "7", "So ngay khoa quyen dat san"],
    ["refund_rate_user_on_time", "100", "Ty le hoan tien khi user huy dung han"],
    ["refund_rate_manager_fault", "100", "Ty le hoan tien khi phia san huy"],
    ["waitlist_response_minutes", "10", "So phut user duoc phan hoi sau khi duoc notify waitlist"],
    ["no_show_penalty_points", "1", "Diem phat khi manager xac nhan no-show"],
    ["late_cancellation_violation_enabled", "true", "Bat ghi vi pham khi user huy sat gio"],
    ["late_cancellation_penalty_points", "1", "Diem phat khi user huy sat gio"]
  ] as const;

  for (const [settingKey, settingValue, description] of settings) {
    await prisma.systemSetting.upsert({
      where: { settingKey },
      update: {
        settingValue,
        description,
        updatedByUserId: adminUserId
      },
      create: {
        settingKey,
        settingValue,
        description,
        updatedByUserId: adminUserId
      }
    });
  }
}

type BookingItemSeed = {
  bookingItemId: string;
  courtId: string;
  startDatetime: Date;
  endDatetime: Date;
  unitPrice: string;
  amount: string;
  bookingStatus: BookingStatus;
  checkinTime?: Date | null;
  checkedInByUserId?: string | null;
  completedByUserId?: string | null;
  noShowMarkedByUserId?: string | null;
  managerNote?: string | null;
};

type BookingOrderSeed = {
  bookingOrderId: string;
  bookingCode: string;
  userId: string;
  totalAmount: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  holdExpiresAt?: Date | null;
  note?: string | null;
  cancelReason?: string | null;
  cancelledByUserId?: string | null;
  cancelledAt?: Date | null;
  refundable?: boolean;
  createdAt: Date;
  items: BookingItemSeed[];
};

async function seedBookingOrdersAndItems(orders: BookingOrderSeed[]) {
  for (const order of orders) {
    await prisma.bookingOrder.upsert({
      where: { bookingOrderId: order.bookingOrderId },
      update: {
        bookingCode: order.bookingCode,
        userId: order.userId,
        totalAmount: order.totalAmount,
        bookingStatus: order.bookingStatus,
        paymentStatus: order.paymentStatus,
        refundable: order.refundable ?? true,
        holdExpiresAt: order.holdExpiresAt ?? null,
        note: order.note ?? null,
        cancelReason: order.cancelReason ?? null,
        cancelledByUserId: order.cancelledByUserId ?? null,
        cancelledAt: order.cancelledAt ?? null,
        createdAt: order.createdAt
      },
      create: {
        bookingOrderId: order.bookingOrderId,
        bookingCode: order.bookingCode,
        userId: order.userId,
        totalAmount: order.totalAmount,
        bookingStatus: order.bookingStatus,
        paymentStatus: order.paymentStatus,
        refundable: order.refundable ?? true,
        holdExpiresAt: order.holdExpiresAt ?? null,
        note: order.note ?? null,
        cancelReason: order.cancelReason ?? null,
        cancelledByUserId: order.cancelledByUserId ?? null,
        cancelledAt: order.cancelledAt ?? null,
        createdAt: order.createdAt
      }
    });

    for (const item of order.items) {
      await prisma.bookingItem.upsert({
        where: { bookingItemId: item.bookingItemId },
        update: {
          bookingOrderId: order.bookingOrderId,
          courtId: item.courtId,
          startDatetime: item.startDatetime,
          endDatetime: item.endDatetime,
          unitPrice: item.unitPrice,
          amount: item.amount,
          bookingStatus: item.bookingStatus,
          checkinTime: item.checkinTime ?? null,
          checkedInByUserId: item.checkedInByUserId ?? null,
          completedByUserId: item.completedByUserId ?? null,
          noShowMarkedByUserId: item.noShowMarkedByUserId ?? null,
          managerNote: item.managerNote ?? null,
          createdAt: order.createdAt
        },
        create: {
          bookingItemId: item.bookingItemId,
          bookingOrderId: order.bookingOrderId,
          courtId: item.courtId,
          startDatetime: item.startDatetime,
          endDatetime: item.endDatetime,
          unitPrice: item.unitPrice,
          amount: item.amount,
          bookingStatus: item.bookingStatus,
          checkinTime: item.checkinTime ?? null,
          checkedInByUserId: item.checkedInByUserId ?? null,
          completedByUserId: item.completedByUserId ?? null,
          noShowMarkedByUserId: item.noShowMarkedByUserId ?? null,
          managerNote: item.managerNote ?? null,
          createdAt: order.createdAt
        }
      });
    }
  }
}

async function seedPayments(orders: BookingOrderSeed[]) {
  const paymentByOrderId = new Map<string, string>([
    [bookingOrderIds.completed, paymentIds.completed],
    [bookingOrderIds.confirmedFuture, paymentIds.confirmedFuture],
    [bookingOrderIds.pendingHold, paymentIds.pendingHold],
    [bookingOrderIds.paymentProcessing, paymentIds.paymentProcessing],
    [bookingOrderIds.paymentExpired, paymentIds.paymentExpired],
    [bookingOrderIds.userCancelledOnTime, paymentIds.userCancelledOnTime],
    [bookingOrderIds.lateCancelled, paymentIds.lateCancelled],
    [bookingOrderIds.managerCancelled, paymentIds.managerCancelled],
    [bookingOrderIds.noShow, paymentIds.noShow],
    [bookingOrderIds.checkinExpired, paymentIds.checkinExpired],
    [bookingOrderIds.inUse, paymentIds.inUse],
    [bookingOrderIds.managerConfirmedToday, paymentIds.managerConfirmedToday],
    [bookingOrderIds.comboConfirmed, paymentIds.comboConfirmed]
  ]);

  for (const order of orders) {
    const paymentId = paymentByOrderId.get(order.bookingOrderId);
    if (!paymentId) {
      continue;
    }

    const isSuccess = order.paymentStatus === PaymentStatus.SUCCESS;
    const isExpired = order.paymentStatus === PaymentStatus.EXPIRED;
    const paymentStatus =
      order.paymentStatus === PaymentStatus.INITIATED ? PaymentStatus.INITIATED : order.paymentStatus;

    await prisma.payment.upsert({
      where: { paymentId },
      update: {
        bookingOrderId: order.bookingOrderId,
        userId: order.userId,
        amount: order.totalAmount,
        paymentMethod: "MOCK",
        gatewayTransactionId: `seed_${order.bookingCode.toLowerCase()}`,
        paymentStatus,
        rawCallback: isSuccess
          ? { provider: "seed", status: "SUCCESS" }
          : isExpired
            ? { provider: "seed", status: "EXPIRED" }
            : undefined,
        paidAt: isSuccess ? addMinutes(order.createdAt, 5) : null,
        createdAt: addMinutes(order.createdAt, 2)
      },
      create: {
        paymentId,
        bookingOrderId: order.bookingOrderId,
        userId: order.userId,
        amount: order.totalAmount,
        paymentMethod: "MOCK",
        gatewayTransactionId: `seed_${order.bookingCode.toLowerCase()}`,
        paymentStatus,
        rawCallback: isSuccess
          ? { provider: "seed", status: "SUCCESS" }
          : isExpired
            ? { provider: "seed", status: "EXPIRED" }
            : undefined,
        paidAt: isSuccess ? addMinutes(order.createdAt, 5) : null,
        createdAt: addMinutes(order.createdAt, 2)
      }
    });
  }
}

async function seedRefunds(input: {
  sampleUserId: string;
  managerUserId: string;
  adminUserId: string;
}) {
  const refunds = [
    {
      refundId: refundIds.userCancelledOnTime,
      paymentId: paymentIds.userCancelledOnTime,
      bookingOrderId: bookingOrderIds.userCancelledOnTime,
      bookingItemId: bookingItemIds.userCancelledOnTime,
      refundAmount: "130000.00",
      refundReason: "User cancelled before configured cancel window",
      refundStatus: RefundStatus.SUCCESS,
      requestedByUserId: input.sampleUserId,
      processedByUserId: input.adminUserId,
      gatewayRefundId: "seed_refund_user_cancel_success",
      requestedAt: addMinutes(atLocalTime(-3, 9), 10),
      processedAt: addMinutes(atLocalTime(-3, 9), 20)
    },
    {
      refundId: refundIds.managerCancelled,
      paymentId: paymentIds.managerCancelled,
      bookingOrderId: bookingOrderIds.managerCancelled,
      bookingItemId: bookingItemIds.managerCancelled,
      refundAmount: "120000.00",
      refundReason: "Manager cancelled because court became unavailable",
      refundStatus: RefundStatus.REQUESTED,
      requestedByUserId: input.managerUserId,
      processedByUserId: null,
      gatewayRefundId: null,
      requestedAt: addMinutes(atLocalTime(-1, 13), 5),
      processedAt: null
    }
  ];

  for (const refund of refunds) {
    await prisma.refund.upsert({
      where: { refundId: refund.refundId },
      update: refund,
      create: refund
    });
  }
}

type OrderHistorySeed = {
  historyId: string;
  bookingOrderId: string;
  actionByUserId?: string | null;
  oldStatus?: BookingStatus | null;
  newStatus: BookingStatus;
  actionType: string;
  note?: string | null;
  changedAt: Date;
};

type ItemHistorySeed = {
  historyId: string;
  bookingItemId: string;
  actionByUserId?: string | null;
  oldStatus?: BookingStatus | null;
  newStatus: BookingStatus;
  actionType: string;
  note?: string | null;
  changedAt: Date;
};

function buildOrderHistories(order: BookingOrderSeed, index: number, managerUserId: string): OrderHistorySeed[] {
  const histories: OrderHistorySeed[] = [
    {
      historyId: seedUuid(1100 + index * 10),
      bookingOrderId: order.bookingOrderId,
      actionByUserId: order.userId,
      oldStatus: null,
      newStatus: BookingStatus.PENDING_PAYMENT,
      actionType: "USER_CREATE_BOOKING_ORDER_HOLD",
      note: "Seeded booking hold",
      changedAt: order.createdAt
    }
  ];

  if (order.bookingStatus === BookingStatus.PENDING_PAYMENT) {
    return histories;
  }

  if (order.bookingStatus === BookingStatus.PAYMENT_PROCESSING) {
    histories.push({
      historyId: seedUuid(1101 + index * 10),
      bookingOrderId: order.bookingOrderId,
      actionByUserId: order.userId,
      oldStatus: BookingStatus.PENDING_PAYMENT,
      newStatus: BookingStatus.PAYMENT_PROCESSING,
      actionType: "USER_START_PAYMENT",
      note: "Payment is being processed",
      changedAt: addMinutes(order.createdAt, 2)
    });
    return histories;
  }

  if (order.bookingStatus === BookingStatus.PAYMENT_EXPIRED) {
    histories.push({
      historyId: seedUuid(1101 + index * 10),
      bookingOrderId: order.bookingOrderId,
      actionByUserId: null,
      oldStatus: BookingStatus.PENDING_PAYMENT,
      newStatus: BookingStatus.PAYMENT_EXPIRED,
      actionType: "EXPIRE_PAYMENT_HOLD",
      note: "Seeded expired payment hold",
      changedAt: addMinutes(order.createdAt, 12)
    });
    return histories;
  }

  histories.push({
    historyId: seedUuid(1101 + index * 10),
    bookingOrderId: order.bookingOrderId,
    actionByUserId: null,
    oldStatus: BookingStatus.PENDING_PAYMENT,
    newStatus: BookingStatus.CONFIRMED,
    actionType: "PAYMENT_SUCCESS_CONFIRM_BOOKING",
    note: "Seeded payment success confirmation",
    changedAt: addMinutes(order.createdAt, 5)
  });

  if (order.bookingStatus === BookingStatus.CONFIRMED) {
    return histories;
  }

  const finalActionMap: Partial<Record<BookingStatus, string>> = {
    [BookingStatus.CANCELLED_BY_USER]: "USER_CANCEL_BOOKING_ORDER",
    [BookingStatus.CANCELLED_BY_MANAGER]: "MANAGER_CANCEL_BOOKING",
    [BookingStatus.CANCELLED_BY_ADMIN]: "ADMIN_CANCEL_BOOKING",
    [BookingStatus.CHECKIN_EXPIRED]: "EXPIRE_CHECKIN",
    [BookingStatus.NO_SHOW]: "MANAGER_MARK_NO_SHOW",
    [BookingStatus.IN_USE]: "MANAGER_CHECK_IN_BOOKING_ITEM",
    [BookingStatus.COMPLETED]: "AUTO_COMPLETE_BOOKING_ITEM"
  };

  histories.push({
    historyId: seedUuid(1102 + index * 10),
    bookingOrderId: order.bookingOrderId,
    actionByUserId:
      order.bookingStatus === BookingStatus.CANCELLED_BY_USER ? order.userId :
        order.bookingStatus === BookingStatus.CANCELLED_BY_MANAGER || order.bookingStatus === BookingStatus.NO_SHOW || order.bookingStatus === BookingStatus.IN_USE
          ? managerUserId
          : null,
    oldStatus: BookingStatus.CONFIRMED,
    newStatus: order.bookingStatus,
    actionType: finalActionMap[order.bookingStatus] ?? "SEED_BOOKING_ORDER_STATUS",
    note: order.cancelReason ?? order.note ?? "Seeded operational status",
    changedAt: order.cancelledAt ?? addMinutes(order.createdAt, 15)
  });

  return histories;
}

function buildItemHistories(order: BookingOrderSeed, item: BookingItemSeed, orderIndex: number, itemIndex: number, managerUserId: string): ItemHistorySeed[] {
  const base = 1300 + orderIndex * 20 + itemIndex * 5;
  const histories: ItemHistorySeed[] = [
    {
      historyId: seedUuid(base),
      bookingItemId: item.bookingItemId,
      actionByUserId: order.userId,
      oldStatus: null,
      newStatus: BookingStatus.PENDING_PAYMENT,
      actionType: "USER_CREATE_BOOKING_ITEM_HOLD",
      note: "Seeded booking item hold",
      changedAt: order.createdAt
    }
  ];

  if (item.bookingStatus === BookingStatus.PENDING_PAYMENT) {
    return histories;
  }

  if (item.bookingStatus === BookingStatus.PAYMENT_PROCESSING) {
    histories.push({
      historyId: seedUuid(base + 1),
      bookingItemId: item.bookingItemId,
      actionByUserId: order.userId,
      oldStatus: BookingStatus.PENDING_PAYMENT,
      newStatus: BookingStatus.PAYMENT_PROCESSING,
      actionType: "USER_START_PAYMENT",
      note: "Payment is being processed",
      changedAt: addMinutes(order.createdAt, 2)
    });
    return histories;
  }

  if (item.bookingStatus === BookingStatus.PAYMENT_EXPIRED) {
    histories.push({
      historyId: seedUuid(base + 1),
      bookingItemId: item.bookingItemId,
      actionByUserId: null,
      oldStatus: BookingStatus.PENDING_PAYMENT,
      newStatus: BookingStatus.PAYMENT_EXPIRED,
      actionType: "EXPIRE_PAYMENT_HOLD",
      note: "Seeded expired payment hold",
      changedAt: addMinutes(order.createdAt, 12)
    });
    return histories;
  }

  histories.push({
    historyId: seedUuid(base + 1),
    bookingItemId: item.bookingItemId,
    actionByUserId: null,
    oldStatus: BookingStatus.PENDING_PAYMENT,
    newStatus: BookingStatus.CONFIRMED,
    actionType: "PAYMENT_SUCCESS_CONFIRM_BOOKING_ITEM",
    note: "Seeded payment success confirmation",
    changedAt: addMinutes(order.createdAt, 5)
  });

  if (item.bookingStatus === BookingStatus.CONFIRMED) {
    return histories;
  }

  const finalActor =
    item.bookingStatus === BookingStatus.CANCELLED_BY_USER ? order.userId :
      item.bookingStatus === BookingStatus.CANCELLED_BY_MANAGER || item.bookingStatus === BookingStatus.NO_SHOW || item.bookingStatus === BookingStatus.IN_USE
        ? managerUserId
        : null;
  const finalActionMap: Partial<Record<BookingStatus, string>> = {
    [BookingStatus.CANCELLED_BY_USER]: "USER_CANCEL_BOOKING_ITEM",
    [BookingStatus.CANCELLED_BY_MANAGER]: "MANAGER_CANCEL_BOOKING_ITEM",
    [BookingStatus.CANCELLED_BY_ADMIN]: "ADMIN_CANCEL_BOOKING_ITEM",
    [BookingStatus.CHECKIN_EXPIRED]: "EXPIRE_CHECKIN",
    [BookingStatus.NO_SHOW]: "MANAGER_MARK_NO_SHOW",
    [BookingStatus.IN_USE]: "MANAGER_CHECK_IN_BOOKING_ITEM",
    [BookingStatus.COMPLETED]: "AUTO_COMPLETE_BOOKING_ITEM"
  };

  histories.push({
    historyId: seedUuid(base + 2),
    bookingItemId: item.bookingItemId,
    actionByUserId: finalActor,
    oldStatus: BookingStatus.CONFIRMED,
    newStatus: item.bookingStatus,
    actionType: finalActionMap[item.bookingStatus] ?? "SEED_BOOKING_ITEM_STATUS",
    note: item.managerNote ?? order.cancelReason ?? order.note ?? "Seeded operational status",
    changedAt: order.cancelledAt ?? item.checkinTime ?? addMinutes(order.createdAt, 15)
  });

  return histories;
}

async function seedStatusHistories(orders: BookingOrderSeed[], managerUserId: string) {
  for (const [orderIndex, order] of orders.entries()) {
    const orderHistories = buildOrderHistories(order, orderIndex, managerUserId);
    for (const history of orderHistories) {
      await prisma.bookingOrderStatusHistory.upsert({
        where: { bookingOrderStatusHistoryId: history.historyId },
        update: {
          bookingOrderId: history.bookingOrderId,
          actionByUserId: history.actionByUserId ?? null,
          oldStatus: history.oldStatus ?? null,
          newStatus: history.newStatus,
          actionType: history.actionType,
          note: history.note ?? null,
          changedAt: history.changedAt
        },
        create: {
          bookingOrderStatusHistoryId: history.historyId,
          bookingOrderId: history.bookingOrderId,
          actionByUserId: history.actionByUserId ?? null,
          oldStatus: history.oldStatus ?? null,
          newStatus: history.newStatus,
          actionType: history.actionType,
          note: history.note ?? null,
          changedAt: history.changedAt
        }
      });
    }

    for (const [itemIndex, item] of order.items.entries()) {
      const itemHistories = buildItemHistories(order, item, orderIndex, itemIndex, managerUserId);
      for (const history of itemHistories) {
        await prisma.bookingItemStatusHistory.upsert({
          where: { bookingItemStatusHistoryId: history.historyId },
          update: {
            bookingItemId: history.bookingItemId,
            actionByUserId: history.actionByUserId ?? null,
            oldStatus: history.oldStatus ?? null,
            newStatus: history.newStatus,
            actionType: history.actionType,
            note: history.note ?? null,
            changedAt: history.changedAt
          },
          create: {
            bookingItemStatusHistoryId: history.historyId,
            bookingItemId: history.bookingItemId,
            actionByUserId: history.actionByUserId ?? null,
            oldStatus: history.oldStatus ?? null,
            newStatus: history.newStatus,
            actionType: history.actionType,
            note: history.note ?? null,
            changedAt: history.changedAt
          }
        });
      }
    }
  }
}

async function seedCourtStatusHistories(adminUserId: string) {
  const histories = [
    {
      courtStatusHistoryId: courtStatusHistoryIds.volleyballClosed,
      courtId: courtIds.volleyballA,
      updatedByUserId: adminUserId,
      oldStatus: CourtStatus.ACTIVE,
      newStatus: CourtStatus.TEMP_CLOSED,
      reason: "Seed: tam dong de bao duong mat san",
      updatedAt: atLocalTime(-2, 9)
    },
    {
      courtStatusHistoryId: courtStatusHistoryIds.gymMaintenance,
      courtId: courtIds.gymA,
      updatedByUserId: adminUserId,
      oldStatus: CourtStatus.ACTIVE,
      newStatus: CourtStatus.MAINTENANCE,
      reason: "Seed: bao tri thiet bi dinh ky",
      updatedAt: atLocalTime(-1, 8)
    }
  ];

  for (const history of histories) {
    await prisma.courtStatusHistory.upsert({
      where: { courtStatusHistoryId: history.courtStatusHistoryId },
      update: history,
      create: history
    });
  }
}

async function seedViolations(input: {
  lateUserId: string;
  restrictedUserId: string;
  managerUserId: string;
}) {
  const violations = [
    {
      violationId: violationIds.lateCancel,
      userId: input.lateUserId,
      bookingItemId: bookingItemIds.lateCancelled,
      violationType: ViolationType.LATE_CANCEL,
      penaltyPoints: 1,
      description: "Seed: user cancelled after configured cancel window",
      recordedByUserId: null,
      isWaived: false,
      recordedAt: atLocalTime(-1, 15, 10)
    },
    {
      violationId: violationIds.noShow,
      userId: input.restrictedUserId,
      bookingItemId: bookingItemIds.noShow,
      violationType: ViolationType.NO_SHOW,
      penaltyPoints: 3,
      description: "Seed: manager confirmed no-show",
      recordedByUserId: input.managerUserId,
      isWaived: false,
      recordedAt: atLocalTime(-1, 11, 30)
    }
  ];

  for (const violation of violations) {
    await prisma.violation.upsert({
      where: { violationId: violation.violationId },
      update: violation,
      create: violation
    });
  }
}

async function seedWaitlist(input: {
  staffUserId: string;
  externalUserId: string;
  sampleUserId: string;
  staffPriorityGroupId: string;
  externalPriorityGroupId: string;
  studentPriorityGroupId: string;
}) {
  const now = new Date();
  const waitlistEntries = [
    {
      waitlistEntryId: waitlistIds.waitingForConfirmedSlot,
      userId: input.externalUserId,
      courtId: courtIds.footballA,
      priorityGroupId: input.externalPriorityGroupId,
      desiredStartDatetime: atLocalTime(1, 8),
      desiredEndDatetime: atLocalTime(1, 9),
      priorityOrder: 30,
      status: WaitlistStatus.WAITING,
      registeredAt: addMinutes(now, -80),
      notifiedAt: null,
      expiresAt: null
    },
    {
      waitlistEntryId: waitlistIds.notifiedReadyToBook,
      userId: input.staffUserId,
      courtId: courtIds.badmintonB,
      priorityGroupId: input.staffPriorityGroupId,
      desiredStartDatetime: atLocalTime(1, 16),
      desiredEndDatetime: atLocalTime(1, 17),
      priorityOrder: 10,
      status: WaitlistStatus.NOTIFIED,
      registeredAt: addMinutes(now, -70),
      notifiedAt: addMinutes(now, -2),
      expiresAt: addMinutes(now, 8)
    },
    {
      waitlistEntryId: waitlistIds.expired,
      userId: input.sampleUserId,
      courtId: courtIds.tennisA,
      priorityGroupId: input.studentPriorityGroupId,
      desiredStartDatetime: atLocalTime(-1, 15),
      desiredEndDatetime: atLocalTime(-1, 16),
      priorityOrder: 20,
      status: WaitlistStatus.EXPIRED,
      registeredAt: atLocalTime(-2, 10),
      notifiedAt: atLocalTime(-1, 12),
      expiresAt: atLocalTime(-1, 12, 10)
    },
    {
      waitlistEntryId: waitlistIds.booked,
      userId: input.staffUserId,
      courtId: courtIds.footballA,
      priorityGroupId: input.staffPriorityGroupId,
      desiredStartDatetime: atLocalTime(2, 14),
      desiredEndDatetime: atLocalTime(2, 15),
      priorityOrder: 10,
      status: WaitlistStatus.BOOKED,
      registeredAt: atLocalTime(-1, 9),
      notifiedAt: atLocalTime(-1, 10),
      expiresAt: atLocalTime(-1, 10, 10)
    }
  ];

  for (const entry of waitlistEntries) {
    await prisma.waitlistEntry.upsert({
      where: { waitlistEntryId: entry.waitlistEntryId },
      update: entry,
      create: entry
    });
  }
}

async function upsertNotification(input: {
  sequence: number;
  userId: string;
  bookingOrderId?: string | null;
  bookingItemId?: string | null;
  title: string;
  content: string;
  notificationType: NotificationType;
  isRead?: boolean;
  createdAt: Date;
}) {
  const notificationId = seedUuid(1500 + input.sequence);
  await prisma.notification.upsert({
    where: { notificationId },
    update: {
      userId: input.userId,
      bookingOrderId: input.bookingOrderId ?? null,
      bookingItemId: input.bookingItemId ?? null,
      title: input.title,
      content: input.content,
      notificationType: input.notificationType,
      channel: "IN_APP",
      isRead: input.isRead ?? false,
      createdAt: input.createdAt
    },
    create: {
      notificationId,
      userId: input.userId,
      bookingOrderId: input.bookingOrderId ?? null,
      bookingItemId: input.bookingItemId ?? null,
      title: input.title,
      content: input.content,
      notificationType: input.notificationType,
      channel: "IN_APP",
      isRead: input.isRead ?? false,
      createdAt: input.createdAt
    }
  });
}

async function seedNotifications(input: {
  sampleUserId: string;
  staffUserId: string;
  externalUserId: string;
  lateUserId: string;
  restrictedUserId: string;
}) {
  await Promise.all([
    upsertNotification({
      sequence: 1,
      userId: input.sampleUserId,
      bookingOrderId: bookingOrderIds.confirmedFuture,
      bookingItemId: bookingItemIds.confirmedFuture,
      title: "Booking da duoc xac nhan",
      content: "Thanh toan thanh cong, lich dat san cua ban da duoc xac nhan.",
      notificationType: NotificationType.PAYMENT_SUCCESS,
      createdAt: addMinutes(atLocalTime(-1, 10), 5)
    }),
    upsertNotification({
      sequence: 2,
      userId: input.externalUserId,
      bookingOrderId: bookingOrderIds.pendingHold,
      bookingItemId: bookingItemIds.pendingHold,
      title: "Booking dang cho thanh toan",
      content: "Slot dang duoc giu tam thoi. Vui long thanh toan 100% truoc khi het han.",
      notificationType: NotificationType.BOOKING_CREATED,
      createdAt: addMinutes(new Date(), -4)
    }),
    upsertNotification({
      sequence: 3,
      userId: input.externalUserId,
      bookingOrderId: bookingOrderIds.paymentExpired,
      bookingItemId: bookingItemIds.paymentExpired,
      title: "Giu cho da het han",
      content: "Booking khong duoc thanh toan dung han nen da het hieu luc.",
      notificationType: NotificationType.PAYMENT_EXPIRED,
      isRead: true,
      createdAt: atLocalTime(-1, 9, 15)
    }),
    upsertNotification({
      sequence: 4,
      userId: input.sampleUserId,
      bookingOrderId: bookingOrderIds.userCancelledOnTime,
      bookingItemId: bookingItemIds.userCancelledOnTime,
      title: "Yeu cau hoan tien da hoan tat",
      content: "Refund cho booking huy dung han da xu ly thanh cong.",
      notificationType: NotificationType.REFUND_SUCCESS,
      isRead: true,
      createdAt: atLocalTime(-3, 9, 20)
    }),
    upsertNotification({
      sequence: 5,
      userId: input.sampleUserId,
      bookingOrderId: bookingOrderIds.managerCancelled,
      bookingItemId: bookingItemIds.managerCancelled,
      title: "Booking bi huy do su co san",
      content: "Quan ly san da huy booking va tao yeu cau hoan tien.",
      notificationType: NotificationType.BOOKING_CANCELLED,
      createdAt: atLocalTime(-1, 13, 5)
    }),
    upsertNotification({
      sequence: 6,
      userId: input.lateUserId,
      bookingOrderId: bookingOrderIds.checkinExpired,
      bookingItemId: bookingItemIds.checkinExpired,
      title: "Qua gio check-in",
      content: "Booking item da qua thoi gian check-in cho phep. Vui long lien he quan ly san.",
      notificationType: NotificationType.CHECKIN_EXPIRED,
      createdAt: atLocalTime(0, 9, 20)
    }),
    upsertNotification({
      sequence: 7,
      userId: input.restrictedUserId,
      bookingOrderId: bookingOrderIds.noShow,
      bookingItemId: bookingItemIds.noShow,
      title: "No-show da duoc ghi nhan",
      content: "Ban da bi ghi nhan no-show va cong diem vi pham.",
      notificationType: NotificationType.NO_SHOW,
      createdAt: atLocalTime(-1, 11, 30)
    }),
    upsertNotification({
      sequence: 8,
      userId: input.restrictedUserId,
      bookingOrderId: bookingOrderIds.noShow,
      bookingItemId: bookingItemIds.noShow,
      title: "Quyen dat san bi han che",
      content: "Diem vi pham da vuot nguong, quyen dat san cua ban bi khoa tam thoi.",
      notificationType: NotificationType.BOOKING_PERMISSION_RESTRICTED,
      createdAt: atLocalTime(-1, 11, 31)
    }),
    upsertNotification({
      sequence: 9,
      userId: input.staffUserId,
      title: "Slot waitlist da san sang",
      content: "Khung gio ban dang cho da trong. Ban co 10 phut de xac nhan dat san.",
      notificationType: NotificationType.WAITLIST_NOTIFIED,
      createdAt: addMinutes(new Date(), -2)
    }),
    upsertNotification({
      sequence: 10,
      userId: input.sampleUserId,
      title: "Luot cho da het han",
      content: "Luot cho dat san da het han vi ban khong xac nhan trong thoi gian cho phep.",
      notificationType: NotificationType.WAITLIST_EXPIRED,
      isRead: true,
      createdAt: atLocalTime(-1, 12, 10)
    }),
    upsertNotification({
      sequence: 11,
      userId: input.lateUserId,
      bookingOrderId: bookingOrderIds.lateCancelled,
      bookingItemId: bookingItemIds.lateCancelled,
      title: "Vi pham huy muon",
      content: "He thong da ghi nhan vi pham huy booking sat gio.",
      notificationType: NotificationType.VIOLATION_RECORDED,
      createdAt: atLocalTime(-1, 15, 10)
    }),
    upsertNotification({
      sequence: 12,
      userId: input.sampleUserId,
      bookingOrderId: bookingOrderIds.managerCancelled,
      bookingItemId: bookingItemIds.managerCancelled,
      title: "Refund dang cho xu ly",
      content: "Yeu cau hoan tien do su co san da duoc tao.",
      notificationType: NotificationType.REFUND_REQUESTED,
      createdAt: atLocalTime(-1, 13, 6)
    })
  ]);
}

async function upsertAuditLog(input: {
  auditLogId: string;
  actorUserId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  createdAt: Date;
}) {
  await prisma.auditLog.upsert({
    where: { auditLogId: input.auditLogId },
    update: {
      actorUserId: input.actorUserId ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      oldValue: input.oldValue ?? Prisma.JsonNull,
      newValue: input.newValue ?? Prisma.JsonNull,
      createdAt: input.createdAt
    },
    create: {
      auditLogId: input.auditLogId,
      actorUserId: input.actorUserId ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      oldValue: input.oldValue ?? Prisma.JsonNull,
      newValue: input.newValue ?? Prisma.JsonNull,
      createdAt: input.createdAt
    }
  });
}

async function seedAuditLogs(input: {
  adminUserId: string;
  managerUserId: string;
}) {
  await Promise.all([
    upsertAuditLog({
      auditLogId: auditLogIds.bookingRuleUpdated,
      actorUserId: input.adminUserId,
      entityType: "BOOKING_RULE",
      entityId: "DEFAULT",
      action: "UPDATE_BOOKING_RULE",
      oldValue: { maxBookingsPerDay: 2 },
      newValue: { maxBookingsPerDay: 4, source: "seed" },
      createdAt: atLocalTime(-5, 8)
    }),
    upsertAuditLog({
      auditLogId: auditLogIds.managerCancel,
      actorUserId: input.managerUserId,
      entityType: "BOOKING_ORDER",
      entityId: bookingOrderIds.managerCancelled,
      action: "MANAGER_CANCEL_BOOKING",
      oldValue: { bookingStatus: "CONFIRMED" },
      newValue: { bookingStatus: "CANCELLED_BY_MANAGER", reason: "Seed: court unavailable" },
      createdAt: atLocalTime(-1, 13)
    }),
    upsertAuditLog({
      auditLogId: auditLogIds.noShowMarked,
      actorUserId: input.managerUserId,
      entityType: "BOOKING_ITEM",
      entityId: bookingItemIds.noShow,
      action: "MARK_NO_SHOW",
      oldValue: { bookingStatus: "CHECKIN_EXPIRED" },
      newValue: { bookingStatus: "NO_SHOW", violationPoints: 3 },
      createdAt: atLocalTime(-1, 11, 30)
    }),
    upsertAuditLog({
      auditLogId: auditLogIds.lateCancelViolation,
      actorUserId: null,
      entityType: "VIOLATION",
      entityId: violationIds.lateCancel,
      action: "CREATE_LATE_CANCEL_VIOLATION",
      oldValue: null,
      newValue: { violationType: "LATE_CANCEL", penaltyPoints: 1 },
      createdAt: atLocalTime(-1, 15, 10)
    }),
    upsertAuditLog({
      auditLogId: auditLogIds.courtMaintenance,
      actorUserId: input.adminUserId,
      entityType: "COURT",
      entityId: courtIds.gymA,
      action: "UPDATE_COURT_STATUS",
      oldValue: { status: "ACTIVE" },
      newValue: { status: "MAINTENANCE", reason: "Seed: equipment maintenance" },
      createdAt: atLocalTime(-1, 8)
    })
  ]);
}

function buildOperationalOrders(input: {
  sampleUserId: string;
  staffUserId: string;
  externalUserId: string;
  lateUserId: string;
  restrictedUserId: string;
  managerUserId: string;
}): BookingOrderSeed[] {
  const now = new Date();

  return [
    {
      bookingOrderId: bookingOrderIds.completed,
      bookingCode: "SEED-COMPLETED-001",
      userId: input.sampleUserId,
      totalAmount: "120000.00",
      bookingStatus: BookingStatus.COMPLETED,
      paymentStatus: PaymentStatus.SUCCESS,
      holdExpiresAt: null,
      note: "Seed completed booking",
      createdAt: atLocalTime(-3, 8),
      items: [
        {
          bookingItemId: bookingItemIds.completed,
          courtId: courtIds.footballA,
          startDatetime: atLocalTime(-2, 7),
          endDatetime: atLocalTime(-2, 8),
          unitPrice: "120000.00",
          amount: "120000.00",
          bookingStatus: BookingStatus.COMPLETED,
          checkinTime: atLocalTime(-2, 7, 2),
          checkedInByUserId: input.managerUserId,
          completedByUserId: null
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.confirmedFuture,
      bookingCode: "SEED-CONFIRMED-001",
      userId: input.sampleUserId,
      totalAmount: "120000.00",
      bookingStatus: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.SUCCESS,
      holdExpiresAt: null,
      note: "Seed future confirmed booking",
      createdAt: atLocalTime(-1, 10),
      items: [
        {
          bookingItemId: bookingItemIds.confirmedFuture,
          courtId: courtIds.footballA,
          startDatetime: atLocalTime(1, 8),
          endDatetime: atLocalTime(1, 9),
          unitPrice: "120000.00",
          amount: "120000.00",
          bookingStatus: BookingStatus.CONFIRMED
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.pendingHold,
      bookingCode: "SEED-HOLD-001",
      userId: input.externalUserId,
      totalAmount: "120000.00",
      bookingStatus: BookingStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.INITIATED,
      holdExpiresAt: addMinutes(now, 10),
      note: "Seed active payment hold",
      createdAt: addMinutes(now, -3),
      items: [
        {
          bookingItemId: bookingItemIds.pendingHold,
          courtId: courtIds.footballA,
          startDatetime: atLocalTime(1, 10),
          endDatetime: atLocalTime(1, 11),
          unitPrice: "120000.00",
          amount: "120000.00",
          bookingStatus: BookingStatus.PENDING_PAYMENT
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.paymentProcessing,
      bookingCode: "SEED-PROCESSING-001",
      userId: input.staffUserId,
      totalAmount: "160000.00",
      bookingStatus: BookingStatus.PAYMENT_PROCESSING,
      paymentStatus: PaymentStatus.PROCESSING,
      holdExpiresAt: addMinutes(now, 10),
      note: "Seed payment processing booking",
      createdAt: addMinutes(now, -2),
      items: [
        {
          bookingItemId: bookingItemIds.paymentProcessing,
          courtId: courtIds.tennisA,
          startDatetime: atLocalTime(1, 15),
          endDatetime: atLocalTime(1, 16),
          unitPrice: "160000.00",
          amount: "160000.00",
          bookingStatus: BookingStatus.PAYMENT_PROCESSING
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.paymentExpired,
      bookingCode: "SEED-EXPIRED-001",
      userId: input.externalUserId,
      totalAmount: "60000.00",
      bookingStatus: BookingStatus.PAYMENT_EXPIRED,
      paymentStatus: PaymentStatus.EXPIRED,
      holdExpiresAt: atLocalTime(-1, 8, 10),
      note: "Seed expired hold",
      createdAt: atLocalTime(-1, 8),
      items: [
        {
          bookingItemId: bookingItemIds.paymentExpired,
          courtId: courtIds.badmintonA,
          startDatetime: atLocalTime(-1, 8),
          endDatetime: atLocalTime(-1, 9),
          unitPrice: "60000.00",
          amount: "60000.00",
          bookingStatus: BookingStatus.PAYMENT_EXPIRED
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.userCancelledOnTime,
      bookingCode: "SEED-USER-CANCEL-001",
      userId: input.sampleUserId,
      totalAmount: "130000.00",
      bookingStatus: BookingStatus.CANCELLED_BY_USER,
      paymentStatus: PaymentStatus.SUCCESS,
      holdExpiresAt: null,
      note: "Seed on-time user cancellation",
      cancelReason: "User changed schedule before cancel window",
      cancelledByUserId: input.sampleUserId,
      cancelledAt: atLocalTime(-3, 9),
      createdAt: atLocalTime(-4, 8),
      items: [
        {
          bookingItemId: bookingItemIds.userCancelledOnTime,
          courtId: courtIds.tennisA,
          startDatetime: atLocalTime(3, 8),
          endDatetime: atLocalTime(3, 9),
          unitPrice: "130000.00",
          amount: "130000.00",
          bookingStatus: BookingStatus.CANCELLED_BY_USER
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.lateCancelled,
      bookingCode: "SEED-LATE-CANCEL-001",
      userId: input.lateUserId,
      totalAmount: "90000.00",
      bookingStatus: BookingStatus.CANCELLED_BY_USER,
      paymentStatus: PaymentStatus.SUCCESS,
      holdExpiresAt: null,
      note: "Seed late cancellation with violation",
      cancelReason: "User cancelled too close to start time",
      cancelledByUserId: input.lateUserId,
      cancelledAt: atLocalTime(-1, 15),
      refundable: false,
      createdAt: atLocalTime(-2, 8),
      items: [
        {
          bookingItemId: bookingItemIds.lateCancelled,
          courtId: courtIds.volleyballA,
          startDatetime: atLocalTime(-1, 16),
          endDatetime: atLocalTime(-1, 17),
          unitPrice: "90000.00",
          amount: "90000.00",
          bookingStatus: BookingStatus.CANCELLED_BY_USER
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.managerCancelled,
      bookingCode: "SEED-MANAGER-CANCEL-001",
      userId: input.sampleUserId,
      totalAmount: "120000.00",
      bookingStatus: BookingStatus.CANCELLED_BY_MANAGER,
      paymentStatus: PaymentStatus.SUCCESS,
      holdExpiresAt: null,
      note: "Seed manager cancellation",
      cancelReason: "Court unavailable because of facility issue",
      cancelledByUserId: input.managerUserId,
      cancelledAt: atLocalTime(-1, 13),
      createdAt: atLocalTime(-2, 10),
      items: [
        {
          bookingItemId: bookingItemIds.managerCancelled,
          courtId: courtIds.basketballA,
          startDatetime: atLocalTime(2, 9),
          endDatetime: atLocalTime(2, 10),
          unitPrice: "120000.00",
          amount: "120000.00",
          bookingStatus: BookingStatus.CANCELLED_BY_MANAGER,
          managerNote: "Court unavailable because of facility issue"
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.noShow,
      bookingCode: "SEED-NOSHOW-001",
      userId: input.restrictedUserId,
      totalAmount: "120000.00",
      bookingStatus: BookingStatus.NO_SHOW,
      paymentStatus: PaymentStatus.SUCCESS,
      holdExpiresAt: null,
      note: "Seed no-show booking",
      createdAt: atLocalTime(-2, 8),
      items: [
        {
          bookingItemId: bookingItemIds.noShow,
          courtId: courtIds.basketballA,
          startDatetime: atLocalTime(-1, 11),
          endDatetime: atLocalTime(-1, 12),
          unitPrice: "120000.00",
          amount: "120000.00",
          bookingStatus: BookingStatus.NO_SHOW,
          noShowMarkedByUserId: input.managerUserId,
          managerNote: "User did not arrive after check-in window"
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.checkinExpired,
      bookingCode: "SEED-CHECKIN-EXPIRED-001",
      userId: input.lateUserId,
      totalAmount: "60000.00",
      bookingStatus: BookingStatus.CHECKIN_EXPIRED,
      paymentStatus: PaymentStatus.SUCCESS,
      holdExpiresAt: null,
      note: "Seed check-in expired item awaiting manager action",
      createdAt: atLocalTime(-1, 8),
      items: [
        {
          bookingItemId: bookingItemIds.checkinExpired,
          courtId: courtIds.badmintonA,
          startDatetime: atLocalTime(0, 9),
          endDatetime: atLocalTime(0, 10),
          unitPrice: "60000.00",
          amount: "60000.00",
          bookingStatus: BookingStatus.CHECKIN_EXPIRED
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.inUse,
      bookingCode: "SEED-INUSE-001",
      userId: input.staffUserId,
      totalAmount: "120000.00",
      bookingStatus: BookingStatus.IN_USE,
      paymentStatus: PaymentStatus.SUCCESS,
      holdExpiresAt: null,
      note: "Seed item currently in use",
      createdAt: atLocalTime(-1, 8),
      items: [
        {
          bookingItemId: bookingItemIds.inUse,
          courtId: courtIds.basketballA,
          startDatetime: atLocalTime(0, 10),
          endDatetime: atLocalTime(0, 11),
          unitPrice: "120000.00",
          amount: "120000.00",
          bookingStatus: BookingStatus.IN_USE,
          checkinTime: atLocalTime(0, 10, 2),
          checkedInByUserId: input.managerUserId
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.managerConfirmedToday,
      bookingCode: "SEED-TODAY-CONFIRMED-001",
      userId: input.externalUserId,
      totalAmount: "150000.00",
      bookingStatus: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.SUCCESS,
      holdExpiresAt: null,
      note: "Seed manager schedule confirmed item",
      createdAt: atLocalTime(-1, 9),
      items: [
        {
          bookingItemId: bookingItemIds.managerConfirmedToday,
          courtId: courtIds.footballB,
          startDatetime: atLocalTime(0, 18),
          endDatetime: atLocalTime(0, 19),
          unitPrice: "150000.00",
          amount: "150000.00",
          bookingStatus: BookingStatus.CONFIRMED
        }
      ]
    },
    {
      bookingOrderId: bookingOrderIds.comboConfirmed,
      bookingCode: "SEED-COMBO-001",
      userId: input.staffUserId,
      totalAmount: "210000.00",
      bookingStatus: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.SUCCESS,
      holdExpiresAt: null,
      note: "Seed combo booking with multiple courts",
      createdAt: atLocalTime(-1, 11),
      items: [
        {
          bookingItemId: bookingItemIds.comboFootball,
          courtId: courtIds.footballA,
          startDatetime: atLocalTime(2, 14),
          endDatetime: atLocalTime(2, 15),
          unitPrice: "120000.00",
          amount: "120000.00",
          bookingStatus: BookingStatus.CONFIRMED
        },
        {
          bookingItemId: bookingItemIds.comboBadminton,
          courtId: courtIds.badmintonA,
          startDatetime: atLocalTime(2, 14),
          endDatetime: atLocalTime(2, 15),
          unitPrice: "90000.00",
          amount: "90000.00",
          bookingStatus: BookingStatus.CONFIRMED
        }
      ]
    }
  ];
}

async function main() {
  await migrateLegacySeedIds();

  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const priorityGroups = await seedPriorityGroups();
  const roles = await seedRoles();
  const users = await seedUsers(priorityGroups, passwordHash);

  await Promise.all([
    assignRole(users.adminUser.userId, roles.user.roleId),
    assignRole(users.adminUser.userId, roles.admin.roleId),
    assignRole(users.managerUser.userId, roles.user.roleId),
    assignRole(users.managerUser.userId, roles.fieldManager.roleId),
    assignRole(users.sampleUser.userId, roles.user.roleId),
    assignRole(users.staffUser.userId, roles.user.roleId),
    assignRole(users.externalUser.userId, roles.user.roleId),
    assignRole(users.lateUser.userId, roles.user.roleId),
    assignRole(users.restrictedUser.userId, roles.user.roleId)
  ]);

  const courtTypes = await seedCourtTypes();
  const courts = await seedCourts(courtTypes);

  await Promise.all([
    seedOperatingHours(courts.footballA.courtId),
    seedOperatingHours(courts.badmintonA.courtId, { slotDurationMinutes: 60 }),
    seedOperatingHours(courts.basketballA.courtId),
    seedOperatingHours(courts.footballB.courtId),
    seedOperatingHours(courts.badmintonB.courtId),
    seedOperatingHours(courts.tennisA.courtId, { weekdayOpenTime: "07:00", weekdayCloseTime: "21:00" }),
    seedOperatingHours(courts.volleyballA.courtId),
    seedOperatingHours(courts.multipurposeA.courtId),
    seedOperatingHours(courts.gymA.courtId, { weekdayOpenTime: "07:00", weekdayCloseTime: "20:00", weekendCloseTime: "18:00" })
  ]);

  await Promise.all([
    seedPricingRule({ pricingRuleId: pricingRuleIds.footballAMorning, courtId: courts.footballA.courtId, adminUserId: users.adminUser.userId, startTime: "06:00", endTime: "17:00", priceAmount: "120000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.footballAEvening, courtId: courts.footballA.courtId, adminUserId: users.adminUser.userId, startTime: "17:00", endTime: "22:00", priceAmount: "180000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.badmintonAMorning, courtId: courts.badmintonA.courtId, adminUserId: users.adminUser.userId, startTime: "06:00", endTime: "17:00", priceAmount: "60000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.badmintonAEvening, courtId: courts.badmintonA.courtId, adminUserId: users.adminUser.userId, startTime: "17:00", endTime: "22:00", priceAmount: "90000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.basketballAMorning, courtId: courts.basketballA.courtId, adminUserId: users.adminUser.userId, startTime: "06:00", endTime: "17:00", priceAmount: "120000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.basketballAEvening, courtId: courts.basketballA.courtId, adminUserId: users.adminUser.userId, startTime: "17:00", endTime: "22:00", priceAmount: "150000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.footballBMorning, courtId: courts.footballB.courtId, adminUserId: users.adminUser.userId, startTime: "06:00", endTime: "17:00", priceAmount: "100000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.footballBEvening, courtId: courts.footballB.courtId, adminUserId: users.adminUser.userId, startTime: "17:00", endTime: "22:00", priceAmount: "150000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.badmintonBDefault, courtId: courts.badmintonB.courtId, adminUserId: users.adminUser.userId, startTime: "06:00", endTime: "22:00", priceAmount: "75000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.tennisADefault, courtId: courts.tennisA.courtId, adminUserId: users.adminUser.userId, startTime: "07:00", endTime: "21:00", priceAmount: "160000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.volleyballADefault, courtId: courts.volleyballA.courtId, adminUserId: users.adminUser.userId, startTime: "06:00", endTime: "22:00", priceAmount: "90000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.multipurposeADefault, courtId: courts.multipurposeA.courtId, adminUserId: users.adminUser.userId, startTime: "06:00", endTime: "22:00", priceAmount: "220000.00" }),
    seedPricingRule({ pricingRuleId: pricingRuleIds.gymADefault, courtId: courts.gymA.courtId, adminUserId: users.adminUser.userId, startTime: "07:00", endTime: "20:00", priceAmount: "80000.00" }),
    seedBookingRules(users.adminUser.userId),
    seedPriorityPolicies(priorityGroups, users.adminUser.userId),
    seedSystemSettings(users.adminUser.userId),
    seedCourtStatusHistories(users.adminUser.userId)
  ]);

  const orders = buildOperationalOrders({
    sampleUserId: users.sampleUser.userId,
    staffUserId: users.staffUser.userId,
    externalUserId: users.externalUser.userId,
    lateUserId: users.lateUser.userId,
    restrictedUserId: users.restrictedUser.userId,
    managerUserId: users.managerUser.userId
  });

  await seedBookingOrdersAndItems(orders);
  await seedPayments(orders);
  await seedRefunds({
    sampleUserId: users.sampleUser.userId,
    managerUserId: users.managerUser.userId,
    adminUserId: users.adminUser.userId
  });
  await seedStatusHistories(orders, users.managerUser.userId);
  await seedViolations({
    lateUserId: users.lateUser.userId,
    restrictedUserId: users.restrictedUser.userId,
    managerUserId: users.managerUser.userId
  });
  await seedWaitlist({
    staffUserId: users.staffUser.userId,
    externalUserId: users.externalUser.userId,
    sampleUserId: users.sampleUser.userId,
    staffPriorityGroupId: priorityGroups.staff.priorityGroupId,
    externalPriorityGroupId: priorityGroups.external.priorityGroupId,
    studentPriorityGroupId: priorityGroups.student.priorityGroupId
  });
  await seedNotifications({
    sampleUserId: users.sampleUser.userId,
    staffUserId: users.staffUser.userId,
    externalUserId: users.externalUser.userId,
    lateUserId: users.lateUser.userId,
    restrictedUserId: users.restrictedUser.userId
  });
  await seedAuditLogs({
    adminUserId: users.adminUser.userId,
    managerUserId: users.managerUser.userId
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

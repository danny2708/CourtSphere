import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const passwordHash = "seed-password-hash-placeholder";

const courtIds = {
  footballA: "00000000-0000-0000-0000-000000000101",
  badmintonA: "00000000-0000-0000-0000-000000000102",
  basketballA: "00000000-0000-0000-0000-000000000103"
};

const pricingRuleIds = {
  footballDefault: "00000000-0000-0000-0000-000000000201",
  badmintonDefault: "00000000-0000-0000-0000-000000000202",
  basketballDefault: "00000000-0000-0000-0000-000000000203"
};

async function seedPriorityGroups() {
  const [staff, student, external] = await Promise.all([
    prisma.priorityGroup.upsert({
      where: { groupCode: "STAFF" },
      update: {
        groupName: "Staff",
        priorityLevel: 1,
        advanceBookingDays: 14,
        description: "Cán bộ/Giảng viên"
      },
      create: {
        groupCode: "STAFF",
        groupName: "Staff",
        priorityLevel: 1,
        advanceBookingDays: 14,
        description: "Cán bộ/Giảng viên"
      }
    }),
    prisma.priorityGroup.upsert({
      where: { groupCode: "STUDENT" },
      update: {
        groupName: "Student",
        priorityLevel: 2,
        advanceBookingDays: 7,
        description: "Sinh viên"
      },
      create: {
        groupCode: "STUDENT",
        groupName: "Student",
        priorityLevel: 2,
        advanceBookingDays: 7,
        description: "Sinh viên"
      }
    }),
    prisma.priorityGroup.upsert({
      where: { groupCode: "EXTERNAL" },
      update: {
        groupName: "External",
        priorityLevel: 3,
        advanceBookingDays: 3,
        description: "Người ngoài trường"
      },
      create: {
        groupCode: "EXTERNAL",
        groupName: "External",
        priorityLevel: 3,
        advanceBookingDays: 3,
        description: "Người ngoài trường"
      }
    })
  ]);

  return { staff, student, external };
}

async function seedRoles() {
  const [user, fieldManager, admin] = await Promise.all([
    prisma.role.upsert({
      where: { roleName: "USER" },
      update: { description: "Người đặt sân" },
      create: { roleName: "USER", description: "Người đặt sân" }
    }),
    prisma.role.upsert({
      where: { roleName: "FIELD_MANAGER" },
      update: { description: "Ban quản lý sân" },
      create: { roleName: "FIELD_MANAGER", description: "Ban quản lý sân" }
    }),
    prisma.role.upsert({
      where: { roleName: "ADMIN" },
      update: { description: "Quản trị viên hệ thống" },
      create: { roleName: "ADMIN", description: "Quản trị viên hệ thống" }
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

async function seedUsers(studentPriorityGroupId: string, staffPriorityGroupId: string) {
  const [adminUser, managerUser, sampleUser] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@courtsphere.local" },
      update: {
        fullName: "CourtSphere Admin",
        priorityGroupId: staffPriorityGroupId
      },
      create: {
        fullName: "CourtSphere Admin",
        email: "admin@courtsphere.local",
        phoneNumber: "0900000001",
        passwordHash,
        identityCode: "ADMIN001",
        priorityGroupId: staffPriorityGroupId
      }
    }),
    prisma.user.upsert({
      where: { email: "manager@courtsphere.local" },
      update: {
        fullName: "Field Manager",
        priorityGroupId: staffPriorityGroupId
      },
      create: {
        fullName: "Field Manager",
        email: "manager@courtsphere.local",
        phoneNumber: "0900000002",
        passwordHash,
        identityCode: "MANAGER001",
        priorityGroupId: staffPriorityGroupId
      }
    }),
    prisma.user.upsert({
      where: { email: "user@courtsphere.local" },
      update: {
        fullName: "Sample Student",
        priorityGroupId: studentPriorityGroupId
      },
      create: {
        fullName: "Sample Student",
        email: "user@courtsphere.local",
        phoneNumber: "0900000003",
        passwordHash,
        identityCode: "STUDENT001",
        priorityGroupId: studentPriorityGroupId
      }
    })
  ]);

  return { adminUser, managerUser, sampleUser };
}

async function seedCourtTypes() {
  const names = ["Bóng đá", "Bóng rổ", "Cầu lông", "Tennis", "Bóng chuyền", "Phòng gym", "Đa năng"];

  const courtTypes = await Promise.all(
    names.map((typeName) =>
      prisma.courtType.upsert({
        where: { typeName },
        update: {},
        create: { typeName }
      })
    )
  );

  return {
    football: courtTypes[0],
    basketball: courtTypes[1],
    badminton: courtTypes[2]
  };
}

async function seedCourts(courtTypeIds: { football: string; badminton: string; basketball: string }) {
  const [footballCourt, badmintonCourt, basketballCourt] = await Promise.all([
    prisma.court.upsert({
      where: { courtId: courtIds.footballA },
      update: {
        courtName: "Sân bóng đá A",
        courtTypeId: courtTypeIds.football
      },
      create: {
        courtId: courtIds.footballA,
        courtName: "Sân bóng đá A",
        courtTypeId: courtTypeIds.football,
        description: "Sân bóng đá 11 người"
      }
    }),
    prisma.court.upsert({
      where: { courtId: courtIds.badmintonA },
      update: {
        courtName: "Sân cầu lông A",
        courtTypeId: courtTypeIds.badminton
      },
      create: {
        courtId: courtIds.badmintonA,
        courtName: "Sân cầu lông A",
        courtTypeId: courtTypeIds.badminton,
        description: "Sân cầu lông trong nhà"
      }
    }),
    prisma.court.upsert({
      where: { courtId: courtIds.basketballA },
      update: {
        courtName: "Sân bóng rổ A",
        courtTypeId: courtTypeIds.basketball
      },
      create: {
        courtId: courtIds.basketballA,
        courtName: "Sân bóng rổ A",
        courtTypeId: courtTypeIds.basketball,
        description: "Sân bóng rổ tiêu chuẩn"
      }
    })
  ]);

  return { footballCourt, badmintonCourt, basketballCourt };
}

async function seedOperatingHours(courtId: string) {
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await prisma.operatingHour.upsert({
      where: {
        courtId_weekday: {
          courtId,
          weekday
        }
      },
      update: {
        openTime: "06:00",
        closeTime: "22:00",
        slotDurationMinutes: 60
      },
      create: {
        courtId,
        weekday,
        openTime: "06:00",
        closeTime: "22:00",
        slotDurationMinutes: 60
      }
    });
  }
}

async function seedPricingRule(pricingRuleId: string, courtId: string, adminUserId: string) {
  await prisma.pricingRule.upsert({
    where: { pricingRuleId },
    update: {
      courtId,
      createdByUserId: adminUserId,
      startTime: "06:00",
      endTime: "22:00",
      priceAmount: "100000.00"
    },
    create: {
      pricingRuleId,
      courtId,
      createdByUserId: adminUserId,
      startTime: "06:00",
      endTime: "22:00",
      priceAmount: "100000.00"
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
      maxBookingsPerDay: 2,
      maxDurationMinutes: 120,
      violationThreshold: 3,
      bookingBanDays: 7,
      refundRateUserOnTime: 100,
      refundRateManagerFault: 100,
      updatedByUserId: adminUserId
    },
    create: {
      ruleName: "DEFAULT",
      holdMinutes: 10,
      cancelBeforeHours: 2,
      lateCheckinMinutes: 15,
      maxBookingsPerDay: 2,
      maxDurationMinutes: 120,
      violationThreshold: 3,
      bookingBanDays: 7,
      refundRateUserOnTime: 100,
      refundRateManagerFault: 100,
      updatedByUserId: adminUserId
    }
  });
}

async function seedPriorityPolicies(
  priorityGroups: Array<{
    priorityGroupId: string;
    groupCode: string;
    groupName: string;
    priorityLevel: number;
    advanceBookingDays: number;
  }>,
  adminUserId: string
) {
  for (const group of priorityGroups) {
    await prisma.priorityPolicy.upsert({
      where: {
        priorityGroupId_policyName: {
          priorityGroupId: group.priorityGroupId,
          policyName: "DEFAULT"
        }
      },
      update: {
        priorityLevel: group.priorityLevel,
        advanceBookingDays: group.advanceBookingDays,
        maxBookingsPerDay: 2,
        maxDurationMinutes: 120,
        canJoinWaitlist: true,
        updatedByUserId: adminUserId
      },
      create: {
        priorityGroupId: group.priorityGroupId,
        policyName: "DEFAULT",
        priorityLevel: group.priorityLevel,
        advanceBookingDays: group.advanceBookingDays,
        maxBookingsPerDay: 2,
        maxDurationMinutes: 120,
        canJoinWaitlist: true,
        updatedByUserId: adminUserId
      }
    });
  }
}

async function seedSystemSettings(adminUserId: string) {
  const settings = [
    ["hold_minutes", "10", "Thời gian giữ slot chờ thanh toán"],
    ["cancel_before_hours", "2", "Số giờ tối thiểu để user hủy có thể hoàn tiền"],
    ["late_checkin_minutes", "15", "Số phút chờ trước khi đánh dấu quá giờ check-in"],
    ["max_bookings_per_day", "2", "Số booking tối đa mỗi ngày"],
    ["max_duration_minutes", "120", "Thời lượng booking tối đa"],
    ["violation_threshold", "3", "Ngưỡng điểm vi phạm để hạn chế đặt sân"],
    ["booking_ban_days", "7", "Số ngày khóa quyền đặt sân"],
    ["refund_rate_user_on_time", "100", "Tỷ lệ hoàn tiền khi user hủy đúng hạn"],
    ["refund_rate_manager_fault", "100", "Tỷ lệ hoàn tiền khi phía sân hủy"]
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

async function main() {
  const priorityGroups = await seedPriorityGroups();
  const roles = await seedRoles();
  const users = await seedUsers(priorityGroups.student.priorityGroupId, priorityGroups.staff.priorityGroupId);

  await Promise.all([
    assignRole(users.adminUser.userId, roles.user.roleId),
    assignRole(users.adminUser.userId, roles.admin.roleId),
    assignRole(users.managerUser.userId, roles.user.roleId),
    assignRole(users.managerUser.userId, roles.fieldManager.roleId),
    assignRole(users.sampleUser.userId, roles.user.roleId)
  ]);

  const courtTypes = await seedCourtTypes();
  const courts = await seedCourts({
    football: courtTypes.football.courtTypeId,
    badminton: courtTypes.badminton.courtTypeId,
    basketball: courtTypes.basketball.courtTypeId
  });

  await Promise.all([
    seedOperatingHours(courts.footballCourt.courtId),
    seedOperatingHours(courts.badmintonCourt.courtId),
    seedOperatingHours(courts.basketballCourt.courtId)
  ]);

  await Promise.all([
    seedPricingRule(pricingRuleIds.footballDefault, courts.footballCourt.courtId, users.adminUser.userId),
    seedPricingRule(pricingRuleIds.badmintonDefault, courts.badmintonCourt.courtId, users.adminUser.userId),
    seedPricingRule(pricingRuleIds.basketballDefault, courts.basketballCourt.courtId, users.adminUser.userId),
    seedBookingRules(users.adminUser.userId),
    seedPriorityPolicies(
      [priorityGroups.staff, priorityGroups.student, priorityGroups.external],
      users.adminUser.userId
    ),
    seedSystemSettings(users.adminUser.userId)
  ]);
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

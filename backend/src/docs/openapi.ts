import packageJson from "../../package.json";

const bearerSecurity = [{ bearerAuth: [] }];

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "CourtSphere API",
    version: packageJson.version,
    description:
      "OpenAPI contract for the CourtSphere school sports court booking backend."
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development"
    }
  ],
  tags: [
    { name: "Auth" },
    { name: "Courts" },
    { name: "Availability" },
    { name: "Bookings" },
    { name: "Payments" },
    { name: "Refunds" },
    { name: "Waitlist" },
    { name: "Notifications" },
    { name: "Manager" },
    { name: "Violations" },
    { name: "Reports" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Invalid request body" },
              details: { type: "object" }
            },
            required: ["code", "message"]
          }
        },
        required: ["error"]
      }
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid bearer token",
        content: {
          "application/json": {
            example: {
              error: {
                code: "UNAUTHENTICATED",
                message: "Authentication is required"
              }
            }
          }
        }
      },
      Forbidden: {
        description: "Authenticated user does not have the required role",
        content: {
          "application/json": {
            example: {
              error: {
                code: "FORBIDDEN",
                message: "You do not have permission to access this resource"
              }
            }
          }
        }
      },
      ValidationError: {
        description: "Request validation failed",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" }
          }
        }
      }
    }
  },
  security: bearerSecurity,
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                fullName: "Nguyen Van A",
                email: "user@example.com",
                phoneNumber: "0900000000",
                password: "password123",
                confirmPassword: "password123",
                priorityGroupCode: "STUDENT",
                identityCode: "STUDENT001"
              }
            }
          }
        },
        responses: {
          "201": {
            description: "User registered",
            content: {
              "application/json": {
                example: {
                  accessToken: "<jwt>",
                  tokenType: "Bearer",
                  user: {
                    id: "uuid",
                    fullName: "Nguyen Van A",
                    email: "user@example.com",
                    phoneNumber: "0900000000",
                    identityCode: "STUDENT001",
                    accountStatus: "ACTIVE",
                    bookingPermissionStatus: "ALLOWED",
                    roles: ["USER"],
                    priorityGroup: {
                      id: "uuid",
                      code: "STUDENT",
                      name: "Student",
                      priorityLevel: 2,
                      advanceBookingDays: 7
                    }
                  }
                }
              }
            }
          },
          "409": { $ref: "#/components/responses/ValidationError" }
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login by email and password",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                email: "user@example.com",
                password: "password123"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Authenticated",
            content: {
              "application/json": {
                example: {
                  accessToken: "<jwt>",
                  tokenType: "Bearer",
                  user: {
                    id: "uuid",
                    fullName: "Nguyen Van A",
                    email: "user@example.com",
                    roles: ["USER"],
                    bookingPermissionStatus: "ALLOWED"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        responses: {
          "200": {
            description: "Current user",
            content: {
              "application/json": {
                example: {
                  user: {
                    id: "uuid",
                    fullName: "Nguyen Van A",
                    email: "user@example.com",
                    accountStatus: "ACTIVE",
                    bookingPermissionStatus: "ALLOWED",
                    roles: ["USER"],
                    priorityGroup: {
                      id: "uuid",
                      code: "STUDENT",
                      name: "Student",
                      priorityLevel: 2,
                      advanceBookingDays: 7
                    }
                  }
                }
              }
            }
          },
          "401": { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout stateless JWT session",
        responses: {
          "200": {
            description: "Logout acknowledged",
            content: {
              "application/json": {
                example: {
                  success: true,
                  message: "Logged out. JWT blacklist is not enabled in the MVP."
                }
              }
            }
          }
        }
      }
    },
    "/api/court-types": {
      get: {
        tags: ["Courts"],
        summary: "List court types",
        responses: {
          "200": {
            description: "Court types",
            content: {
              "application/json": {
                example: {
                  courtTypes: [
                    {
                      id: "uuid",
                      typeName: "Football",
                      description: "Outdoor football fields",
                      status: "ACTIVE"
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/courts": {
      get: {
        tags: ["Courts"],
        summary: "List courts",
        parameters: [
          { name: "keyword", in: "query", schema: { type: "string" } },
          { name: "courtTypeId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string" } }
        ],
        responses: {
          "200": {
            description: "Courts",
            content: {
              "application/json": {
                example: {
                  courts: [
                    {
                      id: "uuid",
                      courtName: "Main Field",
                      description: "Full-size outdoor field",
                      imageUrl: "https://example.com/court.jpg",
                      status: "ACTIVE",
                      courtType: {
                        id: "uuid",
                        typeName: "Football"
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/courts/{id}": {
      get: {
        tags: ["Courts"],
        summary: "Get court detail",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Court detail",
            content: {
              "application/json": {
                example: {
                  court: {
                    id: "uuid",
                    courtName: "Main Field",
                    status: "ACTIVE",
                    courtType: {
                      id: "uuid",
                      typeName: "Football"
                    },
                    operatingHours: [],
                    pricingRules: []
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/courts/{id}/availability": {
      get: {
        tags: ["Availability"],
        summary: "Get generated availability slots for one court and date",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "date", in: "query", required: true, schema: { type: "string", example: "2026-05-20" } },
          { name: "durationMinutes", in: "query", schema: { type: "integer", example: 60 } },
          { name: "includePricing", in: "query", schema: { type: "boolean", example: true } }
        ],
        responses: {
          "200": {
            description: "Availability slots",
            content: {
              "application/json": {
                example: {
                  court: {
                    id: "uuid",
                    courtName: "Main Field",
                    status: "ACTIVE",
                    courtType: {
                      id: "uuid",
                      typeName: "Football"
                    }
                  },
                  date: "2026-05-20",
                  weekday: 3,
                  durationMinutes: 60,
                  policy: {
                    holdMinutes: 10,
                    cancelBeforeHours: 2,
                    lateCheckinMinutes: 15,
                    maxDurationMinutes: 120,
                    maxBookingsPerDay: 2,
                    advanceBookingDays: 7,
                    canJoinWaitlist: true,
                    refundRateUserOnTime: 100,
                    refundRateManagerFault: 100
                  },
                  slots: [
                    {
                      startDatetime: "2026-05-20T08:00:00.000Z",
                      endDatetime: "2026-05-20T09:00:00.000Z",
                      status: "AVAILABLE",
                      priceAmount: 50000
                    },
                    {
                      startDatetime: "2026-05-20T09:00:00.000Z",
                      endDatetime: "2026-05-20T10:00:00.000Z",
                      status: "HOLD",
                      priceAmount: 50000,
                      bookingOrderId: "uuid",
                      bookingItemId: "uuid",
                      unavailableReason: "Slot is temporarily held pending payment"
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/bookings": {
      post: {
        tags: ["Bookings"],
        summary: "Create a booking order hold",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                items: [
                  {
                    courtId: "uuid",
                    startDatetime: "2026-05-21T08:00:00.000Z",
                    endDatetime: "2026-05-21T09:00:00.000Z"
                  }
                ],
                note: "Class training"
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Booking hold created",
            content: {
              "application/json": {
                example: {
                  booking: {
                    id: "uuid",
                    bookingOrderId: "uuid",
                    bookingCode: "BK-20260520-ABC123",
                    bookingStatus: "PENDING_PAYMENT",
                    paymentStatus: "INITIATED",
                    totalAmount: 50000,
                    holdExpiresAt: "2026-05-20T00:10:00.000Z",
                    refundable: true,
                    items: [
                      {
                        id: "uuid",
                        bookingItemId: "uuid",
                        startDatetime: "2026-05-21T08:00:00.000Z",
                        endDatetime: "2026-05-21T09:00:00.000Z",
                        unitPrice: 50000,
                        amount: 50000,
                        bookingStatus: "PENDING_PAYMENT",
                        court: {
                          id: "uuid",
                          courtName: "Main Field",
                          status: "ACTIVE"
                        }
                      }
                    ]
                  }
                }
              }
            }
          },
          "401": { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/api/bookings/my": {
      get: {
        tags: ["Bookings"],
        summary: "List my booking orders",
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } }
        ],
        responses: {
          "200": {
            description: "Owned bookings",
            content: {
              "application/json": {
                example: {
                  bookings: [
                    {
                      id: "uuid",
                      bookingOrderId: "uuid",
                      bookingCode: "BK-20260520-ABC123",
                      bookingStatus: "PENDING_PAYMENT",
                      paymentStatus: "INITIATED",
                      totalAmount: 50000,
                      holdExpiresAt: "2026-05-20T00:10:00.000Z",
                      items: []
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/bookings/{id}": {
      get: {
        tags: ["Bookings"],
        summary: "Get owned booking detail",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Booking detail",
            content: {
              "application/json": {
                example: {
                  booking: {
                    id: "uuid",
                    bookingOrderId: "uuid",
                    bookingCode: "BK-20260520-ABC123",
                    bookingStatus: "PENDING_PAYMENT",
                    paymentStatus: "INITIATED",
                    items: [],
                    statusHistories: [],
                    payments: [],
                    refunds: []
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/bookings/{id}/cancel": {
      post: {
        tags: ["Bookings"],
        summary: "Cancel owned booking order",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { reason: "Schedule changed" }
            }
          }
        },
        responses: {
          "200": {
            description: "Booking cancelled",
            content: {
              "application/json": {
                example: {
                  booking: {
                    id: "uuid",
                    bookingOrderId: "uuid",
                    bookingStatus: "CANCELLED_BY_USER",
                    cancelReason: "Schedule changed",
                    cancelledAt: "2026-05-20T00:00:00.000Z",
                    statusHistories: [
                      {
                        oldStatus: "PENDING_PAYMENT",
                        newStatus: "CANCELLED_BY_USER",
                        actionType: "USER_CANCEL_BOOKING_ORDER"
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/bookings/{id}/payments": {
      post: {
        tags: ["Payments"],
        summary: "Create mock payment for a booking order",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { amount: 50000 }
            }
          }
        },
        responses: {
          "201": {
            description: "Payment created",
            content: {
              "application/json": {
                example: {
                  payment: {
                    id: "uuid",
                    amount: 50000,
                    paymentMethod: "MOCK",
                    gatewayTransactionId: "mock_uuid",
                    paymentStatus: "PROCESSING",
                    paymentUrl: "/mock-payment/mock_uuid",
                    bookingOrder: {
                      id: "uuid",
                      bookingOrderId: "uuid",
                      bookingCode: "BK-20260520-ABC123",
                      bookingStatus: "PAYMENT_PROCESSING",
                      paymentStatus: "PROCESSING",
                      totalAmount: 50000,
                      holdExpiresAt: "2026-05-20T00:10:00.000Z",
                      items: []
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/bookings/{id}/payments/cancel": {
      post: {
        tags: ["Payments"],
        summary: "Cancel active payment session for a booking order",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Payment session cancelled",
            content: {
              "application/json": {
                example: {
                  payment: {
                    id: "uuid",
                    paymentStatus: "CANCELLED",
                    bookingOrder: {
                      bookingOrderId: "uuid",
                      bookingStatus: "PENDING_PAYMENT",
                      paymentStatus: "CANCELLED"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/payments/callback/mock": {
      post: {
        tags: ["Payments"],
        summary: "Mock payment gateway callback",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                gatewayTransactionId: "mock_uuid",
                status: "SUCCESS",
                signature: "mock-signature"
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Callback processed",
            content: {
              "application/json": {
                example: {
                  payment: {
                    id: "uuid",
                    paymentStatus: "SUCCESS",
                    paidAt: "2026-05-20T00:00:00.000Z",
                    bookingOrder: {
                      bookingStatus: "CONFIRMED",
                      paymentStatus: "SUCCESS"
                    }
                  },
                  idempotent: false
                }
              }
            }
          },
          "401": { $ref: "#/components/responses/Unauthorized" }
        }
      }
    },
    "/api/payments/{id}": {
      get: {
        tags: ["Payments"],
        summary: "Get payment detail",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Payment detail",
            content: {
              "application/json": {
                example: {
                  payment: {
                    id: "uuid",
                    amount: 50000,
                    paymentStatus: "SUCCESS",
                    bookingOrder: {
                      bookingOrderId: "uuid",
                      bookingCode: "BK-20260520-ABC123"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/payments": {
      get: {
        tags: ["Payments"],
        summary: "Admin list payments",
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "bookingCode", in: "query", schema: { type: "string" } },
          { name: "userId", in: "query", schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Payments",
            content: {
              "application/json": {
                example: { payments: [] }
              }
            }
          },
          "403": { $ref: "#/components/responses/Forbidden" }
        }
      }
    },
    "/api/admin/refunds": {
      get: {
        tags: ["Refunds"],
        summary: "Admin list refunds",
        parameters: [
          { name: "refundStatus", in: "query", schema: { type: "string" } },
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "bookingCode", in: "query", schema: { type: "string" } },
          { name: "userId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "paymentId", in: "query", schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Refunds",
            content: {
              "application/json": {
                example: {
                  refunds: [
                    {
                      id: "uuid",
                      paymentId: "uuid",
                      bookingOrderId: "uuid",
                      bookingItemId: null,
                      refundAmount: 50000,
                      refundStatus: "REQUESTED"
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/refunds/{id}": {
      get: {
        tags: ["Refunds"],
        summary: "Admin get refund detail",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Refund detail",
            content: {
              "application/json": {
                example: {
                  refund: {
                    id: "uuid",
                    refundAmount: 50000,
                    refundStatus: "REQUESTED"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/refunds/{id}/retry": {
      post: {
        tags: ["Refunds"],
        summary: "Retry or process a mock refund",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          content: {
            "application/json": {
              example: { forceStatus: "SUCCESS" }
            }
          }
        },
        responses: {
          "200": {
            description: "Refund retried",
            content: {
              "application/json": {
                example: {
                  refund: {
                    id: "uuid",
                    refundStatus: "SUCCESS",
                    processedAt: "2026-05-20T00:00:00.000Z"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/waitlist": {
      post: {
        tags: ["Waitlist"],
        summary: "Join waitlist for a court/time range",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                courtId: "uuid",
                startDatetime: "2026-05-21T08:00:00.000Z",
                endDatetime: "2026-05-21T09:00:00.000Z"
              }
            }
          }
        },
        responses: {
          "201": {
            description: "Waitlist entry created",
            content: {
              "application/json": {
                example: {
                  waitlistEntry: {
                    waitlistEntryId: "uuid",
                    desiredStartDatetime: "2026-05-21T08:00:00.000Z",
                    desiredEndDatetime: "2026-05-21T09:00:00.000Z",
                    priorityOrder: 2,
                    status: "WAITING"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/waitlist/my": {
      get: {
        tags: ["Waitlist"],
        summary: "List my waitlist entries",
        parameters: [
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } }
        ],
        responses: {
          "200": {
            description: "Owned waitlist entries",
            content: {
              "application/json": {
                example: { waitlistEntries: [] }
              }
            }
          }
        }
      }
    },
    "/api/waitlist/{id}": {
      delete: {
        tags: ["Waitlist"],
        summary: "Cancel own waitlist entry",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Waitlist entry cancelled",
            content: {
              "application/json": {
                example: {
                  waitlistEntry: {
                    waitlistEntryId: "uuid",
                    status: "CANCELLED"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/waitlist/{id}/book": {
      post: {
        tags: ["Waitlist"],
        summary: "Create booking hold from a notified waitlist entry",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "201": {
            description: "Booking created from waitlist",
            content: {
              "application/json": {
                example: {
                  booking: {
                    bookingOrderId: "uuid",
                    bookingCode: "BK-20260520-ABC123",
                    bookingStatus: "PENDING_PAYMENT",
                    paymentStatus: "INITIATED",
                    holdExpiresAt: "2026-05-20T00:10:00.000Z",
                    totalAmount: 50000,
                    items: [
                      {
                        bookingItemId: "uuid",
                        courtId: "uuid",
                        itemStatus: "PENDING_PAYMENT",
                        unitPrice: 50000,
                        amount: 50000
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List my in-app notifications",
        parameters: [
          { name: "isRead", in: "query", schema: { type: "boolean" } },
          { name: "type", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } }
        ],
        responses: {
          "200": {
            description: "Notifications",
            content: {
              "application/json": {
                example: {
                  notifications: [
                    {
                      id: "uuid",
                      notificationId: "uuid",
                      title: "Payment successful",
                      content: "Payment for booking BK-20260520-ABC123 succeeded.",
                      notificationType: "PAYMENT_SUCCESS",
                      channel: "IN_APP",
                      isRead: false,
                      bookingOrderId: "uuid",
                      bookingItemId: null,
                      createdAt: "2026-05-20T00:00:00.000Z"
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/notifications/unread-count": {
      get: {
        tags: ["Notifications"],
        summary: "Get my unread notification count",
        responses: {
          "200": {
            description: "Unread count",
            content: {
              "application/json": {
                example: { count: 3 }
              }
            }
          }
        }
      }
    },
    "/api/notifications/{id}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark one notification as read",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Notification marked read",
            content: {
              "application/json": {
                example: {
                  notification: {
                    id: "uuid",
                    notificationId: "uuid",
                    isRead: true
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/notifications/read-all": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark all my notifications as read",
        responses: {
          "200": {
            description: "Notifications marked read",
            content: {
              "application/json": {
                example: { updatedCount: 2 }
              }
            }
          }
        }
      }
    },
    "/api/manager/bookings/today": {
      get: {
        tags: ["Manager"],
        summary: "Manager today booking item schedule",
        parameters: [
          { name: "courtId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string" } }
        ],
        responses: {
          "200": {
            description: "Today's schedule",
            content: {
              "application/json": {
                example: { bookingItems: [] }
              }
            }
          },
          "403": { $ref: "#/components/responses/Forbidden" }
        }
      }
    },
    "/api/manager/booking-items/{id}/check-in": {
      post: {
        tags: ["Manager"],
        summary: "Check in a confirmed booking item",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Booking item checked in",
            content: {
              "application/json": {
                example: {
                  bookingItem: {
                    id: "uuid",
                    bookingItemId: "uuid",
                    itemStatus: "IN_USE",
                    checkinTime: "2026-05-20T08:00:00.000Z",
                    checkedInByUserId: "uuid"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/manager/booking-items/{id}/override-checkin": {
      post: {
        tags: ["Manager"],
        summary: "Override late check-in for CHECKIN_EXPIRED item",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { reason: "User arrived late but court is still available" }
            }
          }
        },
        responses: {
          "200": {
            description: "Late check-in overridden",
            content: {
              "application/json": {
                example: {
                  bookingItem: {
                    id: "uuid",
                    bookingItemId: "uuid",
                    itemStatus: "IN_USE"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/manager/booking-items/{id}/no-show": {
      post: {
        tags: ["Manager"],
        summary: "Confirm no-show for CHECKIN_EXPIRED item",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          content: {
            "application/json": {
              example: { reason: "User did not arrive" }
            }
          }
        },
        responses: {
          "200": {
            description: "No-show confirmed",
            content: {
              "application/json": {
                example: {
                  bookingItem: {
                    id: "uuid",
                    bookingItemId: "uuid",
                    itemStatus: "NO_SHOW"
                  },
                  violation: {
                    id: "uuid",
                    violationType: "NO_SHOW",
                    penaltyPoints: 1
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/manager/booking-items/{id}/override-complete": {
      post: {
        tags: ["Manager"],
        summary: "Manually complete an IN_USE item as an exception",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { reason: "Closed early due to facility incident" }
            }
          }
        },
        responses: {
          "200": {
            description: "Booking item completed",
            content: {
              "application/json": {
                example: {
                  bookingItem: {
                    id: "uuid",
                    bookingItemId: "uuid",
                    itemStatus: "COMPLETED"
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/manager/bookings/{id}/cancel": {
      post: {
        tags: ["Manager", "Refunds"],
        summary: "Manager or admin cancels booking due to court issue",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { reason: "Court maintenance issue" }
            }
          }
        },
        responses: {
          "200": {
            description: "Booking cancelled by manager/admin",
            content: {
              "application/json": {
                example: {
                  booking: {
                    bookingOrderId: "uuid",
                    bookingStatus: "CANCELLED_BY_MANAGER",
                    refunds: []
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/violations": {
      get: {
        tags: ["Violations"],
        summary: "Admin or manager list violations",
        parameters: [
          { name: "userId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "violationType", in: "query", schema: { type: "string" } },
          { name: "isWaived", in: "query", schema: { type: "boolean" } },
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "bookingItemId", in: "query", schema: { type: "string", format: "uuid" } }
        ],
        responses: {
          "200": {
            description: "Violations",
            content: {
              "application/json": {
                example: {
                  violations: [
                    {
                      id: "uuid",
                      violationId: "uuid",
                      userId: "uuid",
                      bookingItemId: "uuid",
                      violationType: "NO_SHOW",
                      penaltyPoints: 1,
                      isWaived: false,
                      user: {
                        id: "uuid",
                        fullName: "Nguyen Van A",
                        email: "user@example.com",
                        bookingPermissionStatus: "RESTRICTED",
                        violationPoints: 3
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/violations/{id}/waive": {
      post: {
        tags: ["Violations"],
        summary: "Admin waive a violation",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { reason: "Valid documented reason" }
            }
          }
        },
        responses: {
          "200": {
            description: "Violation waived",
            content: {
              "application/json": {
                example: {
                  violation: {
                    id: "uuid",
                    isWaived: true,
                    penaltyPoints: 1
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/violations/{id}/adjust-points": {
      post: {
        tags: ["Violations"],
        summary: "Admin adjust violation penalty points",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: { penaltyPoints: 2, reason: "Severity adjusted after review" }
            }
          }
        },
        responses: {
          "200": {
            description: "Violation adjusted",
            content: {
              "application/json": {
                example: {
                  violation: {
                    id: "uuid",
                    penaltyPoints: 2,
                    isWaived: false
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/reports/overview": {
      get: {
        tags: ["Reports"],
        summary: "Admin overview dashboard report",
        parameters: [
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } }
        ],
        responses: {
          "200": {
            description: "Overview metrics",
            content: {
              "application/json": {
                example: {
                  overview: {
                    totalBookingOrders: 10,
                    totalBookingItems: 14,
                    totalRevenue: 700000,
                    totalRefundAmount: 50000,
                    totalCancelled: 2,
                    totalNoShow: 1,
                    totalUsers: 42,
                    activeCourts: 6,
                    waitlistCount: 3,
                    violationCount: 4
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/reports/bookings": {
      get: {
        tags: ["Reports"],
        summary: "Admin booking count report",
        parameters: [
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "groupBy", in: "query", schema: { type: "string", enum: ["day", "month"], default: "day" } }
        ],
        responses: {
          "200": {
            description: "Grouped booking counts",
            content: {
              "application/json": {
                example: {
                  report: {
                    groupBy: "day",
                    buckets: [
                      {
                        period: "2026-05-20",
                        bookingOrdersCount: 4,
                        bookingItemsCount: 6
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/reports/revenue": {
      get: {
        tags: ["Reports"],
        summary: "Admin revenue report",
        parameters: [
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "groupBy", in: "query", schema: { type: "string", enum: ["day", "month"], default: "day" } }
        ],
        responses: {
          "200": {
            description: "Grouped revenue",
            content: {
              "application/json": {
                example: {
                  report: {
                    groupBy: "month",
                    buckets: [
                      {
                        period: "2026-05",
                        grossRevenue: 700000,
                        refundAmount: 50000,
                        netRevenue: 650000,
                        successPaymentCount: 10,
                        successRefundCount: 1
                      }
                    ],
                    totals: {
                      grossRevenue: 700000,
                      refundAmount: 50000,
                      netRevenue: 650000,
                      successPaymentCount: 10,
                      successRefundCount: 1
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/reports/courts/usage": {
      get: {
        tags: ["Reports"],
        summary: "Admin court usage report",
        parameters: [
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } }
        ],
        responses: {
          "200": {
            description: "Court usage",
            content: {
              "application/json": {
                example: {
                  report: {
                    courts: [
                      {
                        courtId: "uuid",
                        courtName: "Main Field",
                        bookingItemCount: 8,
                        totalBookedMinutes: 480,
                        completedCount: 5,
                        noShowCount: 1,
                        cancelledCount: 2
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/reports/rates": {
      get: {
        tags: ["Reports"],
        summary: "Admin cancellation/refund/no-show rate report",
        parameters: [
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } }
        ],
        responses: {
          "200": {
            description: "Rate metrics",
            content: {
              "application/json": {
                example: {
                  report: {
                    cancellationRate: 20,
                    refundRate: 25,
                    noShowRate: 10,
                    paymentExpiredRate: 5,
                    waitlistExpiredRate: 12.5,
                    counts: {
                      totalBookingItems: 10,
                      cancelledBookingItems: 2,
                      noShowBookingItems: 1,
                      totalBookingOrders: 20,
                      paymentExpiredOrders: 1,
                      successPayments: 4,
                      successRefunds: 1,
                      totalWaitlistEntries: 8,
                      expiredWaitlistEntries: 1
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/admin/reports/violations": {
      get: {
        tags: ["Reports"],
        summary: "Admin violating users report",
        parameters: [
          { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } }
        ],
        responses: {
          "200": {
            description: "Violating users",
            content: {
              "application/json": {
                example: {
                  report: {
                    users: [
                      {
                        userId: "uuid",
                        fullName: "Nguyen Van A",
                        email: "user@example.com",
                        violationCount: 2,
                        totalPenaltyPoints: 4,
                        currentViolationPoints: 4,
                        bookingPermissionStatus: "RESTRICTED"
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

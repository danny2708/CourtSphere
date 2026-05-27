import type { CourtDetailViewModel } from "../types/court-detail.types";

export const mockCourts: CourtDetailViewModel[] = [
  {
    id: "court-football-01",
    name: "Sân bóng đá trung tâm",
    courtType: "Bóng đá",
    area: "Khu thể thao A",
    capacity: 14,
    rating: 4.8,
    distanceText: "350m",
    address: "Khu thể thao A, cổng chính",
    openTime: "06:00",
    closeTime: "22:00",
    startingPrice: 180000,
    status: "ACTIVE",
    tags: ["Bóng đá", "Ngoài trời", "Sân 7"],
    amenities: ["Đèn chiếu sáng", "Khu thay đồ", "Bãi gửi xe", "Nước uống"],
    hasPromotion: true,
    isFavorite: true,
    description:
      "Sân bóng đá ngoài trời phù hợp cho lớp học thể chất, câu lạc bộ và hoạt động đội nhóm. Mặt sân được bảo trì định kỳ và có hệ thống chiếu sáng buổi tối.",
    operatingHours: [
      { weekday: "Thứ 2 - Thứ 6", openTime: "06:00", closeTime: "22:00" },
      { weekday: "Thứ 7 - Chủ nhật", openTime: "07:00", closeTime: "21:00" }
    ],
    gallery: []
  },
  {
    id: "court-badminton-02",
    name: "Nhà thi đấu cầu lông",
    courtType: "Cầu lông",
    area: "Nhà thi đấu B",
    capacity: 8,
    rating: 4.6,
    distanceText: "500m",
    address: "Nhà thi đấu B, tầng 1",
    openTime: "07:00",
    closeTime: "21:00",
    startingPrice: 90000,
    status: "MAINTENANCE",
    tags: ["Cầu lông", "Trong nhà", "Sàn gỗ"],
    amenities: ["Sàn gỗ", "Quạt thông gió", "Khu chờ", "Tủ gửi đồ"],
    isFavorite: false,
    description:
      "Cụm sân cầu lông trong nhà phục vụ luyện tập cá nhân và thi đấu phong trào. Khu vực này đang bảo trì mặt sàn trong dữ liệu preview.",
    operatingHours: [{ weekday: "Thứ 2 - Chủ nhật", openTime: "07:00", closeTime: "21:00" }],
    gallery: []
  },
  {
    id: "court-tennis-03",
    name: "Sân tennis khu giảng viên",
    courtType: "Tennis",
    area: "Khu thể thao C",
    capacity: 4,
    rating: 4.7,
    distanceText: "1.2km",
    address: "Khu thể thao C, cạnh thư viện",
    openTime: "05:30",
    closeTime: "20:30",
    startingPrice: 150000,
    status: "TEMP_CLOSED",
    tags: ["Tennis", "Ngoài trời", "Ưu tiên"],
    amenities: ["Ghế nghỉ", "Đèn chiếu sáng", "Khu gửi xe"],
    isFavorite: false,
    description:
      "Sân tennis ngoài trời dành cho các buổi luyện tập ngắn và hoạt động câu lạc bộ. Dữ liệu mock đang để tạm đóng để kiểm tra trạng thái UI.",
    operatingHours: [
      { weekday: "Thứ 2 - Thứ 6", openTime: "05:30", closeTime: "20:30" },
      { weekday: "Thứ 7", openTime: "06:00", closeTime: "18:00" }
    ],
    gallery: []
  },
  {
    id: "court-basketball-04",
    name: "Sân bóng rổ cũ",
    courtType: "Bóng rổ",
    area: "Ký túc xá",
    capacity: 10,
    rating: 4.1,
    distanceText: "900m",
    address: "Khu ký túc xá cũ",
    openTime: "06:00",
    closeTime: "18:00",
    startingPrice: 60000,
    status: "RETIRED",
    tags: ["Bóng rổ", "Ngoài trời"],
    amenities: ["Khán đài nhỏ", "Bảng điểm thủ công"],
    isFavorite: false,
    description:
      "Sân bóng rổ cũ được giữ trong mock data để kiểm tra trạng thái ngừng sử dụng và CTA disabled.",
    operatingHours: [{ weekday: "Thứ 2 - Thứ 6", openTime: "06:00", closeTime: "18:00" }],
    gallery: []
  },
  {
    id: "court-multipurpose-05",
    name: "Sân đa năng sinh viên",
    courtType: "Đa năng",
    area: "Khu sinh viên",
    capacity: 24,
    rating: 4.5,
    distanceText: "700m",
    address: "Khu sinh viên, sau hội trường",
    openTime: "06:30",
    closeTime: "22:00",
    startingPrice: 120000,
    status: "ACTIVE",
    tags: ["Đa năng", "Bóng chuyền", "Trong nhà"],
    amenities: ["Lưới đa năng", "Âm thanh cơ bản", "Khu chờ"],
    hasPromotion: true,
    isFavorite: false,
    description:
      "Không gian đa năng cho bóng chuyền, sinh hoạt câu lạc bộ và các sự kiện thể thao quy mô nhỏ.",
    operatingHours: [{ weekday: "Thứ 2 - Chủ nhật", openTime: "06:30", closeTime: "22:00" }],
    gallery: []
  }
];

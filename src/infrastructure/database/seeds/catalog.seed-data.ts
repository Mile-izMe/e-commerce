// Pexels stock photos illustrate this learning catalog, not a real supplier's items.
// Each photo's source/credit is available at https://www.pexels.com/photo/<photoId>/.
export const demoCategories = [
  { slug: 'demo-clothing', name: 'Demo Clothing' },
  { slug: 'demo-electronics', name: 'Demo Electronics' },
  { slug: 'demo-accessories', name: 'Demo Accessories' },
] as const;

interface DemoProduct {
  slug: string;
  name: string;
  category: number;
  price: bigint;
  description: string;
  photoId: number;
  sizes?: readonly string[];
}

const sizes = ['S', 'M', 'L'] as const;

export const demoProducts: readonly DemoProduct[] = [
  {
    slug: 'demo-cotton-t-shirt',
    name: 'Cotton T-Shirt',
    category: 0,
    price: 199000n,
    photoId: 11671964,
    description:
      'Áo thun trắng với phom dáng giản dị. Dễ phối cùng quần jeans hoặc một lớp áo khoác nhẹ cho những ngày thường.',
  },
  {
    slug: 'demo-hoodie',
    name: 'Everyday Hoodie',
    category: 0,
    price: 499000n,
    photoId: 9594667,
    description:
      'Hoodie tông màu dịu, dành cho những bản phối thoải mái. Một lớp áo khoác quen thuộc cho ngày se lạnh.',
  },
  {
    slug: 'demo-linen-shirt',
    name: 'Linen Shirt',
    category: 0,
    price: 359000n,
    photoId: 8788679,
    description:
      'Sơ mi với đường nét thanh thoát, dễ kết hợp cùng trang phục hằng ngày. Mặc riêng hoặc khoác ngoài áo thun.',
  },
  {
    slug: 'demo-joggers',
    name: 'Comfort Joggers',
    category: 0,
    price: 299000n,
    photoId: 4611657,
    description:
      'Quần jogger phom thoải mái, tông màu trung tính. Dành cho một ngày thư thả cùng áo thun và giày thể thao.',
  },
  {
    slug: 'demo-keyboard',
    name: 'Mechanical Keyboard',
    category: 1,
    price: 1299000n,
    photoId: 27791751,
    description:
      'Bàn phím cơ với bố cục gọn gàng, mang lại một điểm nhấn tinh tế cho góc làm việc.',
  },
  {
    slug: 'demo-mouse',
    name: 'Wireless Mouse',
    category: 1,
    price: 399000n,
    photoId: 34396238,
    description:
      'Chuột không dây với thiết kế tối giản. Giữ mặt bàn thông thoáng và dễ mang theo khi làm việc.',
  },
  {
    slug: 'demo-headphones',
    name: 'Wireless Headphones',
    category: 1,
    price: 899000n,
    photoId: 28739256,
    description:
      'Tai nghe chụp tai với kiểu dáng gọn và màu sắc nhẹ nhàng. Một khoảng riêng cho âm nhạc mỗi ngày.',
  },
  {
    slug: 'demo-backpack',
    name: 'Everyday Backpack',
    category: 2,
    price: 459000n,
    photoId: 18510446,
    description:
      'Balo với những chi tiết khóa và quai đeo thực dụng. Đồng hành cùng các vật dụng cần thiết trong ngày.',
  },
  {
    slug: 'demo-tote-bag',
    name: 'Canvas Tote Bag',
    category: 2,
    price: 129000n,
    photoId: 6786895,
    description:
      'Túi tote sáng màu, kiểu dáng đơn giản và dễ phối. Một lựa chọn nhẹ nhàng cho những chuyến đi ngắn.',
  },
  {
    slug: 'demo-cap',
    name: 'Classic Cap',
    category: 2,
    price: 159000n,
    photoId: 38655380,
    description:
      'Mũ lưỡi trai với những đường may gọn gàng. Chi tiết nhỏ hoàn thiện trang phục thường ngày.',
  },
  {
    slug: 'demo-studio-tee',
    name: 'Studio White Tee',
    category: 0,
    price: 229000n,
    photoId: 20669538,
    sizes,
    description:
      'Một chiếc áo thun trắng theo tinh thần tối giản. Phom cơ bản, dễ kết hợp và phù hợp với nhiều lớp trang phục.',
  },
  {
    slug: 'demo-botanical-tee',
    name: 'Botanical Tee',
    category: 0,
    price: 259000n,
    photoId: 31995223,
    sizes,
    description:
      'Áo thun với nét vẽ thực vật nhẹ nhàng. Một điểm nhấn vừa đủ cho bản phối đơn sắc.',
  },
  {
    slug: 'demo-sage-sweatshirt',
    name: 'Sage Sweatshirt',
    category: 0,
    price: 389000n,
    photoId: 9594694,
    sizes,
    description:
      'Sweatshirt xanh nhạt với đường nét giản dị. Phối cùng quần sáng màu để tạo cảm giác nhẹ nhàng.',
  },
  {
    slug: 'demo-knit-sweater',
    name: 'Textured Knit Sweater',
    category: 0,
    price: 549000n,
    photoId: 12944791,
    sizes,
    description:
      'Áo len với bề mặt dệt nổi và sắc màu ấm. Dành cho những ngày muốn thêm chút khác biệt cho trang phục.',
  },
  {
    slug: 'demo-denim-jacket',
    name: 'Everyday Denim Jacket',
    category: 0,
    price: 699000n,
    photoId: 13662505,
    sizes,
    description:
      'Áo khoác denim với cổ bẻ và túi trước quen thuộc. Một lớp khoác dễ phối cùng áo thun hoặc sơ mi.',
  },
  {
    slug: 'demo-city-jacket',
    name: 'City Black Jacket',
    category: 0,
    price: 749000n,
    photoId: 16341730,
    sizes,
    description:
      'Áo khoác đen với đường cắt gọn. Sắc tối tạo điểm tựa cho những bản phối thành thị giản dị.',
  },
  {
    slug: 'demo-sand-jacket',
    name: 'Sand Utility Jacket',
    category: 0,
    price: 649000n,
    photoId: 6909817,
    sizes,
    description:
      'Áo khoác tông cát với nét mộc mạc. Dễ kết hợp cùng denim và các màu trung tính trong tủ đồ.',
  },
  {
    slug: 'demo-relaxed-sweatpants',
    name: 'Relaxed Sweatpants',
    category: 0,
    price: 329000n,
    photoId: 31961168,
    sizes,
    description:
      'Quần dài phom thư giãn, màu sắc trầm dễ phối. Kết hợp cùng sweatshirt cho một bộ đồ thường ngày.',
  },
  {
    slug: 'demo-lounge-shirt',
    name: 'Lounge White Shirt',
    category: 0,
    price: 379000n,
    photoId: 7445019,
    sizes,
    description:
      'Sơ mi trắng mang tinh thần thư thái. Giữ trang phục nhẹ nhàng trong những buổi sáng chậm rãi.',
  },
  {
    slug: 'demo-indigo-jacket',
    name: 'Indigo Denim Jacket',
    category: 0,
    price: 729000n,
    photoId: 11096066,
    sizes,
    description:
      'Áo khoác denim xanh với những đường may rõ nét. Thiết kế quen thuộc để phối cùng các món đồ cơ bản.',
  },
];

export function demoPhotoUrl(photoId: number) {
  return `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=1200`;
}

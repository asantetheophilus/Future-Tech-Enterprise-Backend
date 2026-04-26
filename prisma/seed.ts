import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const db = prisma as any;

const categories = [
  {
    name: "Smartphones",
    slug: "smartphones",
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Laptops",
    slug: "laptops",
    image:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Accessories",
    slug: "accessories",
    image:
      "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Audio",
    slug: "audio",
    image:
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1200&q=80"
  },
  {
    name: "Gaming",
    slug: "gaming",
    image:
      "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=80"
  }
];

const brands = [
  {
    name: "NovaTech",
    slug: "novatech",
    logo:
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Pulse",
    slug: "pulse",
    logo:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "Aether",
    slug: "aether",
    logo:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80"
  },
  {
    name: "CoreX",
    slug: "corex",
    logo:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=600&q=80"
  }
];

const productImages = [
  "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1517059224940-d4af9eec41b7?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1518444065439-e933c06ce9cd?auto=format&fit=crop&w=1000&q=80",
  "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=1000&q=80"
];

async function seed() {
  await prisma.couponUse.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.flashSaleItem.deleteMany();
  await prisma.flashSale.deleteMany();
  await prisma.productVariation.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.promoBanner.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.deliverySetting.deleteMany();
  await prisma.setting.deleteMany();
  await db.siteSettings.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.whatsappSetting.deleteMany();

  const password = await bcrypt.hash("Admin@1234", 12);

  const admin = await prisma.admin.create({
    data: {
      name: "Master Admin",
      email: "admin@pulsecommerce.com",
      password,
      role: "SUPER_ADMIN"
    }
  });

  const customer = await prisma.user.create({
    data: {
      name: "John Shopper",
      email: "customer@store.com",
      password,
      phone: "+233541234567",
      addresses: {
        shipping: {
          fullName: "John Shopper",
          city: "Accra",
          street: "Spintex Road",
          country: "Ghana"
        }
      }
    }
  });

  const vendorOwner = await prisma.user.create({
    data: {
      name: "Ama Seller",
      email: "vendor@store.com",
      password,
      phone: "+233201112233"
    }
  });

  const vendor = await prisma.vendor.create({
    data: {
      name: "Ama",
      storeName: "Ama Gadget Hub",
      status: "ACTIVE",
      ownerId: vendorOwner.id
    }
  });

  const createdCategories = await Promise.all(categories.map((item) => prisma.category.create({ data: item })));
  const createdBrands = await Promise.all(brands.map((item) => prisma.brand.create({ data: item })));

  const products = await Promise.all(
    Array.from({ length: 20 }).map((_, idx) => {
      const category = createdCategories[idx % createdCategories.length];
      const brand = createdBrands[idx % createdBrands.length];
      const price = 49 + idx * 7;
      const comparePrice = price + 20;
      return prisma.product.create({
        data: {
          name: `Product ${idx + 1}`,
          slug: `product-${idx + 1}`,
          description: `Premium tech item ${idx + 1} with modern build quality and long-term reliability.`,
          price,
          comparePrice,
          sku: `SKU-${1000 + idx}`,
          stock: 30 + idx,
          status: "ACTIVE",
          isFeatured: idx < 8,
          vendorId: idx % 3 === 0 ? vendor.id : null, // [VENDOR READY]
          categoryId: category.id,
          brandId: brand.id,
          images: {
            create: [
              {
                url: productImages[idx % productImages.length],
                publicId: `seed/product-${idx + 1}`,
                isFeatured: true
              }
            ]
          },
          variations: {
            create: [
              { type: "size", value: "M", stock: 12, priceModifier: 0 },
              { type: "color", value: "Black", stock: 10, priceModifier: 2 }
            ]
          }
        }
      });
    })
  );

  await Promise.all(
    products.slice(0, 8).map((product, idx) =>
      prisma.review.create({
        data: {
          productId: product.id,
          userId: customer.id,
          rating: (idx % 5) + 1,
          comment: `Review ${idx + 1}: excellent value and premium feel.`,
          status: "APPROVED"
        }
      })
    )
  );

  await prisma.coupon.createMany({
    data: [
      {
        code: "WELCOME10",
        type: "PERCENTAGE",
        value: 10,
        minOrder: 100,
        maxUses: 100,
        isActive: true
      },
      {
        code: "SAVE20",
        type: "FIXED",
        value: 20,
        minOrder: 150,
        maxUses: 100,
        isActive: true
      }
    ]
  });

  await prisma.banner.createMany({
    data: [
      {
        title: "Next Drop Is Live",
        subtitle: "Explore curated devices with same-day dispatch.",
        image:
          "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1800&q=80",
        link: "/products",
        sortOrder: 1
      },
      {
        title: "Upgrade Season",
        subtitle: "Stack deals and free delivery on selected items.",
        image:
          "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1800&q=80",
        link: "/products?featured=true",
        sortOrder: 2
      }
    ]
  });

  await prisma.promoBanner.createMany({
    data: [
      {
        title: "Free Shipping over GHS 300",
        image:
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1500&q=80",
        link: "/products",
        position: "mid-page"
      }
    ]
  });

  const flashSale = await prisma.flashSale.create({
    data: {
      title: "Weekend Flash Deals",
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      isActive: true
    }
  });

  await prisma.flashSaleItem.createMany({
    data: products.slice(0, 4).map((product, idx) => ({
      flashSaleId: flashSale.id,
      productId: product.id,
      discountPercent: 10 + idx * 5,
      maxQty: 3
    }))
  });

  await prisma.deliverySetting.create({
    data: {
      type: "zone",
      flatFee: 15,
      freeThreshold: 300,
      zones: {
        GreaterAccra: 10,
        Ashanti: 18,
        Other: 25
      }
    }
  });

  await prisma.setting.createMany({
    data: [
      {
        key: "store",
        group: "general",
        value: {
          name: "Pulse Commerce",
          contactEmail: "support@store.com",
          social: {
            instagram: "@pulsecommerce",
            x: "@pulsecommerce"
          }
        }
      },
      {
        key: "homepage",
        group: "appearance",
        value: {
          heroTitle: "Own Your Next Upgrade",
          heroSubtitle: "Modern electronics and accessories curated for speed."
        }
      }
    ]
  });

  await prisma.emailTemplate.createMany({
    data: [
      {
        name: "welcome",
        subject: "Welcome to Pulse Commerce",
        htmlBody: "<h1>Welcome {{name}}</h1><p>Thanks for joining our store.</p>",
        variables: { name: "Customer name" }
      },
      {
        name: "order_confirmation",
        subject: "Order Confirmed #{{orderNumber}}",
        htmlBody: "<h1>Order Confirmed</h1><p>Your order {{orderNumber}} has been received.</p>",
        variables: { orderNumber: "Order number" }
      }
    ]
  });

  await prisma.whatsappSetting.create({
    data: {
      number: "233540000000",
      messageTemplate: "Hi, I want to order {{product}} ({{variation}}) qty {{qty}}.",
      isEnabled: true
    }
  });

  // ── Site Settings ──────────────────────────────────────────────────────────
  await db.siteSettings.createMany({
    data: [
      {
        key: "brand",
        group: "brand",
        value: {
          siteName: "Pulse Commerce",
          tagline: "Premium products trusted by thousands of shoppers across Ghana.",
          logoUrl: "",
          faviconUrl: ""
        }
      },
      {
        key: "hero",
        group: "appearance",
        value: {
          title: "Own Your Next Upgrade",
          subtitle: "Modern electronics and accessories curated for speed.",
          ctaPrimary: "Shop Now",
          ctaSecondary: "View Lookbook",
          backgroundImage: "",
          stats: [
            { n: "10K+", label: "Happy Customers" },
            { n: "500+", label: "Products" },
            { n: "4.9★", label: "Rating" }
          ]
        }
      },
      {
        key: "about",
        group: "appearance",
        value: {
          heading: "Why Choose Pulse Commerce?",
          body: "We are Ghana's premier destination for premium electronics and accessories. Every product is sourced and quality-checked to guarantee an exceptional shopping experience.",
          image: ""
        }
      },
      {
        key: "contact",
        group: "contact",
        value: {
          email: "hello@pulsecommerce.com",
          phone: "+233 54 000 0000",
          whatsapp: "233540000000",
          address: "Accra, Ghana"
        }
      },
      {
        key: "social",
        group: "social",
        value: {
          instagram: "#",
          twitter: "#",
          facebook: "#",
          youtube: "#"
        }
      },
      {
        key: "footer",
        group: "footer",
        value: {
          description: "Premium products trusted by thousands of shoppers across Ghana.",
          columns: [
            {
              heading: "Shop",
              links: [
                { label: "All Products", href: "/products" },
                { label: "New Arrivals", href: "/products?sort=newest" },
                { label: "Best Sellers", href: "/products?sort=popular" },
                { label: "Categories", href: "/categories" },
                { label: "Deals & Offers", href: "/products" }
              ]
            },
            {
              heading: "Account",
              links: [
                { label: "Sign In", href: "/auth/login" },
                { label: "Create Account", href: "/auth/register" },
                { label: "My Orders", href: "/orders" },
                { label: "Wishlist", href: "/wishlist" }
              ]
            },
            {
              heading: "Help",
              links: [
                { label: "Contact Us", href: "/contact" },
                { label: "Returns Policy", href: "#" },
                { label: "Shipping Info", href: "#" },
                { label: "FAQ", href: "#" }
              ]
            }
          ],
          trustBadges: [
            { icon: "🚚", label: "Fast Delivery", sub: "1–3 working days" },
            { icon: "🔒", label: "Secure Checkout", sub: "256-bit SSL encrypted" },
            { icon: "↩️", label: "Easy Returns", sub: "30-day hassle-free" },
            { icon: "💬", label: "WhatsApp Support", sub: "Order via chat" },
            { icon: "🏆", label: "Genuine Products", sub: "100% authenticity" }
          ],
          copyrightName: "Pulse Commerce"
        }
      },
      {
        key: "colors",
        group: "appearance",
        value: {
          brand: "#2d6a4f",
          brandLight: "#40916c",
          brandPale: "#d8f3dc",
          accent: "#e76f51",
          bg: "#f7f6f3"
        }
      },
      {
        key: "promo",
        group: "appearance",
        value: {
          barText: "Free delivery on orders over GH₵1,500",
          newsletterTitle: "Stay in the loop",
          newsletterSub: "New arrivals, exclusive deals & more — straight to your inbox."
        }
      }
    ]
  });

  console.log("Seeded successfully", {
    admin: admin.email,
    user: customer.email
  });
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export interface TemplateData {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  defaultCurrency: string;
  items: Array<{
    name: string;
    unit: string;
    qty: number;
    low: number;
    costPrice: number;
    sellPrice: number;
    extra?: Record<string, string>;
  }>;
  machines: Array<{
    name: string;
    maintenanceCost: number;
    everyDays: number;
    powerKw: number;
    notes: string;
    extra?: Record<string, string>;
  }>;
  costs: Array<{
    name: string;
    amount: number;
    period: 'monthly' | 'weekly' | 'daily' | 'yearly';
    extra?: Record<string, string>;
  }>;
}

export const TEMPLATES: Record<string, TemplateData> = {
  kirana: {
    id: 'kirana',
    name: 'Kirana & Grocery Store',
    category: 'Retail & Daily Essentials',
    icon: '🛒',
    description: 'Pre-configured with essential staples, grains, oils, dairy, weighing scales, and typical overheads.',
    defaultCurrency: '₹',
    items: [
      { name: 'Wheat Flour / Atta (10kg)', unit: 'bag', qty: 25, low: 5, costPrice: 320, sellPrice: 380, extra: { Brand: 'Aashirvaad', Aisle: 'Grains Rack 1' } },
      { name: 'Basmati Rice (Premium)', unit: 'kg', qty: 45, low: 10, costPrice: 75, sellPrice: 95, extra: { Variety: 'Daawat Rozana' } },
      { name: 'Mustard Oil (1L Pouch)', unit: 'pouch', qty: 30, low: 8, costPrice: 125, sellPrice: 145, extra: { Brand: 'Fortune Kachi Ghani' } },
      { name: 'Refined Sugar', unit: 'kg', qty: 60, low: 12, costPrice: 38, sellPrice: 44 },
      { name: 'Toor Dal (Unpolished)', unit: 'kg', qty: 35, low: 6, costPrice: 135, sellPrice: 165 },
      { name: 'Amul Butter (500g)', unit: 'pack', qty: 18, low: 4, costPrice: 245, sellPrice: 275, extra: { Storage: 'Deep Freezer' } },
      { name: 'Tata Salt (1kg)', unit: 'pack', qty: 50, low: 10, costPrice: 22, sellPrice: 28 },
    ],
    machines: [
      { name: 'Commercial Deep Freezer (350L)', maintenanceCost: 800, everyDays: 90, powerKw: 0.85, notes: 'Quarterly refrigerant gas check and condenser coil cleaning', extra: { Brand: 'Voltas', Model: 'CF-350' } },
      { name: 'Digital Electronic Weighing Scale', maintenanceCost: 250, everyDays: 180, powerKw: 0.04, notes: 'Annual weights & measures calibration stamping', extra: { Capacity: '30kg', Accuracy: '1g' } },
    ],
    costs: [
      { name: 'Shop Rental', amount: 15000, period: 'monthly' },
      { name: 'Commercial Electricity Bill', amount: 4200, period: 'monthly' },
      { name: 'Trade & Municipal License', amount: 2400, period: 'yearly' },
    ],
  },
  cafe: {
    id: 'cafe',
    name: 'Cafe & Bakery',
    category: 'Hospitality & Beverage',
    icon: '☕',
    description: 'Loaded with coffee beans, milks, bakery goods, cups, espresso machines, and convection ovens.',
    defaultCurrency: '₹',
    items: [
      { name: 'Specialty Espresso Beans (1kg)', unit: 'bag', qty: 16, low: 4, costPrice: 650, sellPrice: 1200, extra: { Roast: 'Medium Dark', Origin: 'Coorg' } },
      { name: 'Full Cream Milk (1L)', unit: 'pouch', qty: 35, low: 10, costPrice: 36, sellPrice: 65 },
      { name: 'Butter Croissants', unit: 'pcs', qty: 24, low: 6, costPrice: 45, sellPrice: 95 },
      { name: 'Vanilla Beverage Syrup (750ml)', unit: 'bottle', qty: 6, low: 2, costPrice: 320, sellPrice: 550, extra: { Brand: 'Monin' } },
      { name: 'Hot Coffee Takeaway Cups (250ml)', unit: 'pcs', qty: 250, low: 50, costPrice: 3.5, sellPrice: 8 },
      { name: 'Almond / Oat Milk (1L)', unit: 'tetra', qty: 12, low: 3, costPrice: 180, sellPrice: 260 },
    ],
    machines: [
      { name: 'Two-Group Commercial Espresso Machine', maintenanceCost: 2400, everyDays: 60, powerKw: 3.2, notes: 'Descale boiler every 60 days. Backflush group heads daily with Cafiza.', extra: { Brand: 'Nuova Simonelli', Voltage: '230V' } },
      { name: 'Convection Baking Oven (4 Trays)', maintenanceCost: 1200, everyDays: 90, powerKw: 2.8, notes: 'Door silicon seal inspection and thermal thermocouple check', extra: { Model: 'Unox LineMiss' } },
      { name: 'Commercial High-Speed Blender', maintenanceCost: 400, everyDays: 120, powerKw: 1.1, notes: 'Drive socket and blade assembly inspection', extra: { Brand: 'Blendtec' } },
    ],
    costs: [
      { name: 'Cafe Floor Space Rent', amount: 28000, period: 'monthly' },
      { name: 'HVAC & Power Utility', amount: 8500, period: 'monthly' },
      { name: 'High-Speed Broadband & Ambient Music', amount: 1200, period: 'monthly' },
    ],
  },
  restaurant: {
    id: 'restaurant',
    name: 'Restaurant & Dhaba',
    category: 'Food & Dining',
    icon: '🍽️',
    description: 'Bulk pantry provisions, cooking oil, dairy, 3-burner ranges, kitchen chillers, and LPG upkeep.',
    defaultCurrency: '₹',
    items: [
      { name: 'Fresh Paneer (Cottage Cheese)', unit: 'kg', qty: 15, low: 4, costPrice: 280, sellPrice: 420 },
      { name: 'Refined Sunflower Oil (15L Tin)', unit: 'tin', qty: 6, low: 2, costPrice: 1850, sellPrice: 2200 },
      { name: 'Basmati Biryani Rice (25kg)', unit: 'bag', qty: 8, low: 2, costPrice: 1900, sellPrice: 2400 },
      { name: 'Onion & Potato Sacks (50kg)', unit: 'sack', qty: 5, low: 2, costPrice: 1100, sellPrice: 1450 },
      { name: 'Handcrafted Garam Masala (1kg)', unit: 'kg', qty: 8, low: 2, costPrice: 480, sellPrice: 700 },
      { name: 'Takeaway Meal Containers (3CP)', unit: 'pcs', qty: 300, low: 50, costPrice: 6, sellPrice: 15 },
    ],
    machines: [
      { name: 'Commercial 3-Burner Gas Cooking Range', maintenanceCost: 900, everyDays: 60, powerKw: 0.2, notes: 'Pilot burners, high-pressure regulator and safety gas cock inspection', extra: { Fuel: 'Commercial LPG' } },
      { name: 'Walk-in Vertical Chiller (4 Door)', maintenanceCost: 1600, everyDays: 90, powerKw: 1.8, notes: 'Condenser radiator de-dusting and defrost timer test', extra: { Capacity: '800L' } },
      { name: 'Kitchen Exhaust Chimney & Duct Hood', maintenanceCost: 1800, everyDays: 45, powerKw: 1.2, notes: 'Baffle filter grease wash and centrifugal fan belt tension', extra: { Duct: 'Galvanized 18-gauge' } },
    ],
    costs: [
      { name: 'Kitchen & Dining Space Rent', amount: 35000, period: 'monthly' },
      { name: 'Commercial LPG Cylinder Replacements', amount: 14000, period: 'monthly' },
      { name: 'Kitchen Municipal Water & Waste Sanitation', amount: 3200, period: 'monthly' },
    ],
  },
  barber: {
    id: 'barber',
    name: 'Salon & Barber Studio',
    category: 'Personal Care & Grooming',
    icon: '💈',
    description: 'Hair waxes, serums, shaving essentials, hydraulic chairs, clippers, towel sterilizers, and linen care.',
    defaultCurrency: '₹',
    items: [
      { name: 'Professional Matte Hair Wax (100g)', unit: 'jar', qty: 20, low: 4, costPrice: 220, sellPrice: 450, extra: { Brand: 'Ustraa / Beardo' } },
      { name: 'Moroccan Argan Hair Serum (100ml)', unit: 'bottle', qty: 14, low: 3, costPrice: 350, sellPrice: 700 },
      { name: 'Cooling Shave Gel (500ml)', unit: 'bottle', qty: 10, low: 2, costPrice: 160, sellPrice: 320 },
      { name: 'Stainless Disposable Blades (100pk)', unit: 'pack', qty: 25, low: 5, costPrice: 120, sellPrice: 200, extra: { Brand: 'Super-Max' } },
      { name: 'Menthol After-Shave Splash (500ml)', unit: 'bottle', qty: 6, low: 2, costPrice: 250, sellPrice: 450 },
    ],
    machines: [
      { name: 'Hydraulic Heavy Barber Chair', maintenanceCost: 500, everyDays: 180, powerKw: 0, notes: 'Hydraulic pump fluid top-up and backrest reclining lock check', extra: { Material: 'Leatherette', Recline: '160 deg' } },
      { name: 'Cordless Professional Hair Clipper Set', maintenanceCost: 350, everyDays: 90, powerKw: 0.05, notes: 'Ceramic blade sharpening, zero-gap calibration and oiling', extra: { Brand: 'Wahl Professional' } },
      { name: 'UV Towel Warmer & Sterilizer Cabinet', maintenanceCost: 400, everyDays: 120, powerKw: 0.35, notes: 'UV germicidal bulb test and thermal fuse inspection', extra: { Capacity: '16L' } },
    ],
    costs: [
      { name: 'Studio Rental', amount: 18000, period: 'monthly' },
      { name: 'Air Conditioning & Studio Power', amount: 6200, period: 'monthly' },
      { name: 'Linen Laundry & Hot Towel Care', amount: 2600, period: 'monthly' },
    ],
  },
  sweets: {
    id: 'sweets',
    name: 'Sweets & Mithai Shop',
    category: 'Confectionery & Traditional',
    icon: '🍬',
    description: 'Fresh mawa, desi ghee, premium nuts, cardamom, kadai cookers, and refrigerated display counters.',
    defaultCurrency: '₹',
    items: [
      { name: 'Fresh Buffalo Mawa / Khoya', unit: 'kg', qty: 25, low: 5, costPrice: 320, sellPrice: 480, extra: { Source: 'Local Dairy Chilling' } },
      { name: 'Pure Desi Cow Ghee (15kg Tin)', unit: 'tin', qty: 4, low: 1, costPrice: 8500, sellPrice: 9800, extra: { Purity: 'Agmark Grade A' } },
      { name: 'Whole Cashews / Kaju (W240)', unit: 'kg', qty: 16, low: 3, costPrice: 680, sellPrice: 920 },
      { name: 'Green Cardamom & Saffron Flakes', unit: 'kg', qty: 2, low: 0.5, costPrice: 2400, sellPrice: 3400 },
      { name: 'Royal Mithai Gift Boxes (1kg)', unit: 'box', qty: 250, low: 50, costPrice: 15, sellPrice: 30 },
    ],
    machines: [
      { name: 'Automatic Mawa Making Kadai Machine', maintenanceCost: 1100, everyDays: 90, powerKw: 1.6, notes: 'Motor gearbox lubrication and teflon bottom scrapers check', extra: { Capacity: '40L' } },
      { name: 'Curved Glass Refrigerated Sweet Counter', maintenanceCost: 950, everyDays: 90, powerKw: 0.75, notes: 'Evaporator fan cleaning and temperature calibration (+4 deg C)', extra: { Length: '6 feet', LED: 'Warm White' } },
      { name: 'Heavy Brass Sugar Syrup Boiling Stove', maintenanceCost: 350, everyDays: 120, powerKw: 0.1, notes: 'Burner nozzle clearing and safety pilot valve check' },
    ],
    costs: [
      { name: 'Shop Front & Kitchen Workshop Rent', amount: 26000, period: 'monthly' },
      { name: 'Commercial Cooking LPG & Electricity', amount: 11500, period: 'monthly' },
      { name: 'FSSAI Food Safety Audit & Hygiene', amount: 3000, period: 'yearly' },
    ],
  },
};

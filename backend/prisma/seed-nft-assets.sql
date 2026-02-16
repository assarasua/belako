-- Seed inicial catálogo NFT Belako (MVP)
-- Ejecutar tras migraciones Prisma en PostgreSQL.

INSERT INTO "NftAsset" ("id", "code", "name", "rarity", "imageUrl", "metadataUri", "active", "createdAt")
VALUES
  ('nft-fan-01', 'BELAKO_FAN_01', 'Belako Banda - Fan Edition', 'fan', 'https://www.belakoband.com/cdn/shop/files/Belako_Banda.jpg?v=1753809570', 'https://belako.bizkardolab.eu/metadata/belako-fan-01.json', true, NOW()),
  ('nft-premium-01', 'BELAKO_PREMIUM_01', 'Belako Grupo - Premium Shot', 'premium', 'https://www.belakoband.com/cdn/shop/files/Belako_grupo.jpg?v=1753809570', 'https://belako.bizkardolab.eu/metadata/belako-premium-01.json', true, NOW()),
  ('nft-legendary-01', 'BELAKO_LEGENDARY_01', 'Belako Press Band - Legendary', 'legendary', 'https://www.belakoband.com/cdn/shop/files/Belako_PRESS_Band_1.jpg?v=1753809570', 'https://belako.bizkardolab.eu/metadata/belako-legendary-01.json', true, NOW()),
  ('nft-superfan-mg-pass', 'BELAKO_SUPERFAN_MG_PASS', 'Belako Superfan Meet & Greet Pass', 'legendary', 'https://www.belakoband.com/cdn/shop/files/Belako_grupo.jpg?v=1753809570', 'https://belako.bizkardolab.eu/metadata/belako-superfan-mg-pass.json', true, NOW()),
  ('nft-fan-02', 'BELAKO_FAN_02', 'Belako Press Band - Fan Alt', 'fan', 'https://www.belakoband.com/cdn/shop/files/Belako_PRESS_Band_1.jpg?v=1753809570', 'https://belako.bizkardolab.eu/metadata/belako-fan-02.json', true, NOW())
ON CONFLICT ("code") DO NOTHING;

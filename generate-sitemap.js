import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://www.hakimiplus.com";
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Variables Supabase absentes : sitemap non généré.");
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const genererSlug = (texte) => {
  if (!texte) return "";
  return texte
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
};

async function run() {
  try {
    const urls = new Set([
      `${SITE_URL}/`,
      `${SITE_URL}/catalogue`,
      `${SITE_URL}/informatique`,
      `${SITE_URL}/livraison`,
      `${SITE_URL}/conditions`,
    ]);

    // 1. Produits visibles sur le site web
    const { data: produits } = await supabase
      .from("produits")
      .select("nom")
      .eq("afficher_web", true);

    (produits || []).forEach((p) => {
      const slug = genererSlug(p.nom);
      if (slug) urls.add(`${SITE_URL}/produit/${slug}`);
    });

    // 2. Catégories, sous-catégories et articles
    const { data: params } = await supabase
      .from("parametres_web")
      .select("categories_hierarchie_json, rubriques_json")
      .eq("id", 1)
      .maybeSingle();

    (params?.categories_hierarchie_json || []).forEach((cat) => {
      const parent = cat.PARENT || cat.parent;
      if (!parent) return;
      const isTech = ["INFORMATIQUE", "SERVICES"].includes(parent.toUpperCase());
      const base = isTech ? "informatique" : "catalogue";
      const parentSlug = genererSlug(parent);
      urls.add(`${SITE_URL}/${base}/${parentSlug}`);

      (cat.sous_categories || cat.enfants || []).forEach((sc) => {
        const subSlug = genererSlug(sc);
        if (subSlug) urls.add(`${SITE_URL}/${base}/${parentSlug}/${subSlug}`);
      });
    });

    (params?.rubriques_json || []).forEach((r) => {
      const slug = genererSlug(r.titre);
      if (slug) urls.add(`${SITE_URL}/article/${slug}`);
    });

    const today = new Date().toISOString().split("T")[0];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls]
  .map(
    (loc) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>`;

    fs.mkdirSync("public", { recursive: true });
    fs.writeFileSync("public/sitemap.xml", xml, "utf-8");
    console.log(`✅ Sitemap généré avec ${urls.size} URLs.`);
  } catch (err) {
    console.warn("⚠️ Erreur lors de la génération du sitemap :", err.message);
    process.exit(0);
  }
}

run();

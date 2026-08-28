-- Ukrainian ('uk') joins SUPPORTED_LOCALES, so kb_article_translations'
-- generated search_vector has to learn its regconfig branch. Stock Postgres
-- ships no 'ukrainian' text-search config, so 'uk' takes the same 'simple'
-- fallback zh-cn/zh-tw already use (whitespace/punctuation tokenizing, no
-- stemming) rather than being silently stemmed by the 'english' ELSE branch.
--
-- A generated column's expression cannot be edited in place on every Postgres
-- this project runs against (ALTER COLUMN ... SET EXPRESSION is 17+), so the
-- column is dropped and re-added with the new CASE. The lineage runs in one
-- transaction, so no code version ever observes the column missing; the GIN
-- index goes with the column and is recreated alongside it.
--
-- The expression below is the verbatim output of localeRegconfigCaseSql('locale')
-- in packages/db/src/schema/kb.ts, which stays the single source of truth.
--
-- @contract: safe-after 0.13.2   (the column is re-added inside the same
-- transaction under the same name and type; no running code loses it)

-- @replay: guarded-by the stored generation expression still lacking a 'uk' branch; once it has one the rewrite is skipped and the catalogue does not move
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = 'public.kb_article_translations'::regclass
      AND a.attname = 'search_vector'
      AND pg_get_expr(d.adbin, d.adrelid) LIKE '%''uk''%'
  ) THEN
    ALTER TABLE "kb_article_translations" DROP COLUMN "search_vector";
    ALTER TABLE "kb_article_translations" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector(CASE locale WHEN 'de' THEN 'german'::regconfig WHEN 'fr' THEN 'french'::regconfig WHEN 'es' THEN 'spanish'::regconfig WHEN 'ar' THEN 'arabic'::regconfig WHEN 'ru' THEN 'russian'::regconfig WHEN 'uk' THEN 'simple'::regconfig WHEN 'pt-br' THEN 'portuguese'::regconfig WHEN 'zh-cn' THEN 'simple'::regconfig WHEN 'zh-tw' THEN 'simple'::regconfig ELSE 'english'::regconfig END, coalesce(title, '')), 'A') || setweight(to_tsvector(CASE locale WHEN 'de' THEN 'german'::regconfig WHEN 'fr' THEN 'french'::regconfig WHEN 'es' THEN 'spanish'::regconfig WHEN 'ar' THEN 'arabic'::regconfig WHEN 'ru' THEN 'russian'::regconfig WHEN 'uk' THEN 'simple'::regconfig WHEN 'pt-br' THEN 'portuguese'::regconfig WHEN 'zh-cn' THEN 'simple'::regconfig WHEN 'zh-tw' THEN 'simple'::regconfig ELSE 'english'::regconfig END, coalesce(content, '')), 'B')) STORED;
    CREATE INDEX "kb_article_translations_search_vector_idx" ON "kb_article_translations" USING gin ("search_vector");
  END IF;
END $$;

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);

async function documentFor(app, locale) {
  const file = new URL(`apps/${app}/public/help/${locale}.json`, root);
  return JSON.parse(await readFile(file, "utf8"));
}

for (const app of ["web", "admin"]) {
  test(`${app} publishes complete and parallel RU/EN help documents`, async () => {
    const ru = await documentFor(app, "ru");
    const en = await documentFor(app, "en");
    assert.equal(ru.version, 1);
    assert.equal(en.version, 1);
    assert.equal(ru.locale, "ru");
    assert.equal(en.locale, "en");
    assert.ok(ru.sections.length >= 7);
    assert.deepEqual(
      ru.sections.map((entry) => entry.id),
      en.sections.map((entry) => entry.id),
    );
    for (const document of [ru, en]) {
      assert.ok(document.title.length > 0 && document.intro.length > 0);
      assert.ok(document.warnings.length >= 3);
      assert.ok(document.example.steps.length >= 3);
      const all = [...document.sections, document.example];
      assert.equal(new Set(all.map((entry) => entry.id)).size, all.length);
      for (const section of all) {
        assert.ok(section.title.length > 0);
        assert.ok(section.paragraphs.length > 0);
        assert.ok(
          section.paragraphs.every((paragraph) => paragraph.length > 0),
        );
      }
    }
  });
}

for (const [app, sectionId] of [
  ["web", "local-viewport-index"],
  ["admin", "local-beekeeper-collection"],
]) {
  test(`${app} describes registered regions without a fixed pilot district`, async () => {
    for (const [locale, regionTerm, districtTerm, obsoleteDistrict] of [
      [
        "en",
        app === "web" ? /register regions/ : /registered provider region/,
        /district/,
        /Yartsevo/i,
      ],
      [
        "ru",
        app === "web"
          ? /зарегистрировать регионы/
          : /зарегистрированный регион/,
        /район/,
        /Ярцев/i,
      ],
    ]) {
      const document = await documentFor(app, locale);
      const section = document.sections.find((entry) => entry.id === sectionId);
      assert.ok(section);
      const content = section.paragraphs.join(" ");
      assert.match(content, regionTerm);
      assert.match(content, districtTerm);
      assert.doesNotMatch(content, obsoleteDistrict);
      if (app === "web") assert.doesNotMatch(content, /Saturn/i);
    }
  });
}

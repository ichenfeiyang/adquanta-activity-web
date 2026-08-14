import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
  ACTIVITY_RULE_FAQS,
  ACTIVITY_RULE_SECTIONS,
  getActivityRuleLocaleKeys,
  getVisibleActivityRuleFaqs,
} from "./activity-rules.js";

const LOCALES = ["en", "id", "ur", "bn", "ne"];

function lookup(source, key) {
  return key.split(".").reduce((value, segment) => value?.[segment], source);
}

async function loadLocale(locale) {
  const url = new URL(`../locales/${locale}.json`, import.meta.url);
  return JSON.parse(await readFile(url, "utf8"));
}

test("activity rules expose stable, unique sections and FAQ entries", () => {
  assert.equal(ACTIVITY_RULE_SECTIONS.length, 10);
  assert.equal(ACTIVITY_RULE_FAQS.length, 12);
  assert.equal(new Set(ACTIVITY_RULE_SECTIONS.map((section) => section.id)).size, ACTIVITY_RULE_SECTIONS.length);
  assert.equal(new Set(ACTIVITY_RULE_FAQS.map((faq) => faq.id)).size, ACTIVITY_RULE_FAQS.length);
  assert.ok(ACTIVITY_RULE_SECTIONS.every((section) => section.titleKey && section.icon));
});

test("rewards center hide FAQ follows backend availability", () => {
  assert.equal(getVisibleActivityRuleFaqs(false).length, 11);
  assert.equal(getVisibleActivityRuleFaqs(undefined).length, 11);
  assert.equal(getVisibleActivityRuleFaqs(true).length, 12);
  assert.equal(getVisibleActivityRuleFaqs(true).at(-1)?.id, "faq12");
});

test("activity rule icons exist in the published public directory", async () => {
  for (const section of ACTIVITY_RULE_SECTIONS) {
    const iconUrl = new URL(`../../public/${section.icon}`, import.meta.url);
    await assert.doesNotReject(access(iconUrl), `${section.id} icon is missing: ${section.icon}`);
  }
});

test("activity rules provide complete copy for every supported locale", async () => {
  const keys = getActivityRuleLocaleKeys();
  assert.equal(new Set(keys).size, keys.length, "rule locale keys should not contain duplicates");

  for (const locale of LOCALES) {
    const messages = await loadLocale(locale);
    for (const key of keys) {
      const value = lookup(messages, key);
      assert.equal(typeof value, "string", `${locale} is missing ${key}`);
      assert.notEqual(value.trim(), "", `${locale} has empty ${key}`);
    }
  }
});

test("activity rules contain meaningful long-form content instead of placeholder copy", async () => {
  for (const locale of LOCALES) {
    const messages = await loadLocale(locale);
    const contentLength = getActivityRuleLocaleKeys()
      .filter((key) => key.includes(".body") || key.includes(".step") || key.includes(".answer") || key.includes(".note"))
      .map((key) => lookup(messages, key) || "")
      .join("")
      .length;

    assert.ok(contentLength > 1200, `${locale} rules content is unexpectedly short`);
  }
});

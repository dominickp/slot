import { getIpHash, sha256Hex } from "./utils.ts";
import assert from "node:assert";

Deno.test(
  "getIpHash produces correct and unique hashes (table-driven)",
  async () => {
    const secret = "test-secret";
    const cases = [
      {
        ip: "192.168.1.1",
        expected:
          "c982e398e394c470005b44479760dd898baa2fafa94ef961368fb81cd16c6844",
      },
      {
        ip: "192.168.1.2",
        expected:
          "9c3ae74b31d1626225e97eef2af427737eae5cec2f473f5233cfaf20b284e1e2",
      },
    ];

    // Collect hashes for all cases
    const hashes = await Promise.all(cases.map((c) => getIpHash(c.ip, secret)));

    // Check uniqueness
    for (let i = 0; i < hashes.length; i++) {
      for (let j = i + 1; j < hashes.length; j++) {
        assert(
          hashes[i] !== hashes[j],
          `Hash for ${cases[i].ip} should be unique from ${cases[j].ip}`,
        );
      }
    }

    // Ccheck for expected outcomes
    for (let i = 0; i < cases.length; i++) {
      if (cases[i].expected) {
        assert(
          hashes[i] == cases[i].expected,
          `Hash for ${cases[i].ip} did not match expected value`,
        );
      }
    }
  },
);

Deno.test(
  "getSha256Hex produces correct and unique values (table-driven)",
  async () => {
    const cases = [
      {
        input:
          "c982e398e394c470005b44479760dd898baa2fafa94ef961368fb81cd16c6844",
        expected:
          "0c765b4510d410c63a986a459e327201b9434bbb98005edaeb8b12c01067f84f",
      },
      {
        input:
          "9c3ae74b31d1626225e97eef2af427737eae5cec2f473f5233cfaf20b284e1e2",
        expected:
          "f64f52adc4ea4c1acdb6f2bc0822e9cf9275f85712bb329f76de4d28cb8b8b2e",
      },
    ];

    // Collect hashes for all cases
    const hashes = await Promise.all(cases.map((c) => sha256Hex(c.input)));

    // Check uniqueness
    for (let i = 0; i < hashes.length; i++) {
      for (let j = i + 1; j < hashes.length; j++) {
        assert(
          hashes[i] !== hashes[j],
          `Hash for ${cases[i].input} should be unique from ${cases[j].input}`,
        );
      }
    }

    // Check for expected outcomes
    for (let i = 0; i < cases.length; i++) {
      if (cases[i].expected) {
        assert(
          hashes[i] == cases[i].expected,
          `Hash for ${cases[i].input} (${hashes[i]}) did not match expected value (${cases[i].expected})`,
        );
      }
    }
  },
);

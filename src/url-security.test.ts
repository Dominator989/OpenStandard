import { describe, expect, it } from "vitest";
import { assertSafeUrl, isPrivateAddress, normalizeUrl, UnsafeUrlError } from "./url-security.js";

describe("URL security", () => {
  it("normalizes domains without a protocol", () => {
    expect(normalizeUrl("example.com").toString()).toBe("https://example.com/");
  });

  it("rejects unsupported protocols and credentials", () => {
    expect(() => normalizeUrl("ftp://example.com")).toThrow(UnsafeUrlError);
    expect(() => normalizeUrl("https://user:password@example.com")).toThrow(UnsafeUrlError);
  });

  it("explains that a scan accepts one website at a time", () => {
    expect(() => normalizeUrl("intersafe.com.au and commbank.com.au")).toThrow("one valid website address");
  });

  it("rejects private and special-use addresses", () => {
    for (const address of ["127.0.0.1", "10.0.0.4", "172.16.0.1", "192.168.1.1", "::1", "fc00::1"]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
  });

  it("rejects local hostnames before DNS resolution", async () => {
    await expect(assertSafeUrl("http://localhost")).rejects.toThrow("Local and internal");
    await expect(assertSafeUrl("http://service.internal")).rejects.toThrow("Local and internal");
  });

  it("rejects non-standard ports", () => {
    expect(() => normalizeUrl("https://example.com:8443")).toThrow("standard HTTP and HTTPS");
  });
});

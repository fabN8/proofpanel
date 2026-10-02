import { describe, expect, it } from "vitest";
import { buildSurveyUrl, checkCompletion, hashToken, minSeconds, newCompletionCode, newToken } from "@/lib/survey/token";

describe("survey tokens", () => {
  it("creates distinct tokens and stable hashes", () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toEqual(b);
    expect(hashToken(a)).toEqual(hashToken(a));
    expect(hashToken(a)).not.toEqual(hashToken(b));
    expect(newCompletionCode()).toMatch(/^[A-Z2-9]{8}$/);
  });

  it("adds the token to a survey link", () => {
    expect(buildSurveyUrl("https://example.org/s?x=1", "tok", "http://localhost:3000")).toBe("https://example.org/s?x=1&pid=tok");
    expect(buildSurveyUrl("https://example.org/s/{pid}", "tok", "http://localhost:3000")).toBe("https://example.org/s/tok");
    expect(buildSurveyUrl("/demo-survey?study=1", "tok", "http://localhost:3000")).toBe(
      "http://localhost:3000/demo-survey?study=1&pid=tok",
    );
  });

  it("requires a third of the expected time by default", () => {
    delete process.env.MIN_TIME_FACTOR;
    expect(minSeconds(3)).toBe(60);
  });
});

describe("completion check", () => {
  const base = { studyStatus: "live", expectedCode: "ABCD2345", estMinutes: 3, startedAt: 0 };

  it("accepts a correct, slow enough completion", () => {
    expect(checkCompletion({ ...base, givenCode: "abcd2345", now: 61_000 })).toEqual({ ok: true });
  });
  it("refuses a wrong code", () => {
    const res = checkCompletion({ ...base, givenCode: "WRONG", now: 61_000 });
    expect(res.ok === false && res.code).toBe("wrong_code");
  });
  it("refuses a completion that is too fast and says how long to wait", () => {
    const res = checkCompletion({ ...base, givenCode: "ABCD2345", now: 10_000 });
    expect(res.ok === false && res.code).toBe("too_fast");
    expect(res.ok === false && res.waitSeconds).toBe(50);
  });
  it("refuses when the study is closed", () => {
    const res = checkCompletion({ ...base, studyStatus: "closed", givenCode: "ABCD2345", now: 61_000 });
    expect(res.ok === false && res.code).toBe("study_closed");
  });
});

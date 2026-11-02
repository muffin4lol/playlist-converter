import { describe, it, expect, vi, beforeEach } from "vitest";
const { database, auth } = vi.hoisted(() => ({
  database: {
    transfer: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    wizardState: { deleteMany: vi.fn(), upsert: vi.fn() },
  },
  auth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: database }));
vi.mock("@/lib/auth", () => ({
  requireSession: auth,
  ownerWhere: (userId: string, id?: string) => ({
    userId,
    ...(id ? { id } : {}),
  }),
}));
import {
  GET as list,
  DELETE as removeAll,
} from "../src/app/api/transfers/route";
import {
  GET as detail,
  DELETE as remove,
  POST as rerun,
} from "../src/app/api/transfers/[id]/route";
const params = { params: Promise.resolve({ id: "someone-elses-transfer" }) };
beforeEach(() => {
  vi.resetAllMocks();
  process.env.APP_URL = "http://localhost:3000";
  auth.mockResolvedValue({ userId: "current-user" });
  database.transfer.findMany.mockResolvedValue([]);
  database.transfer.count.mockResolvedValue(0);
  database.transfer.findFirst.mockResolvedValue(null);
  database.transfer.deleteMany.mockResolvedValue({ count: 0 });
});
describe("strict history ownership", () => {
  it("requires authentication", async () => {
    auth.mockRejectedValue(new Error("Unauthorized"));
    expect(
      (await list(new Request("http://localhost:3000/api/transfers"))).status,
    ).toBe(401);
    expect(database.transfer.findMany).not.toHaveBeenCalled();
  });
  it("scopes filtered paginated queries to current user", async () => {
    await list(
      new Request(
        "http://localhost:3000/api/transfers?platform=spotify&search=night&page=2",
      ),
    );
    expect(database.transfer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "current-user",
          OR: [{ source: "spotify" }, { destination: "spotify" }],
        }),
        skip: 10,
        take: 10,
      }),
    );
  });
  it("returns 404 for another user’s detail and CSV", async () => {
    for (const suffix of ["", "?format=csv"]) {
      expect(
        (
          await detail(
            new Request("http://localhost:3000/api/transfers/x" + suffix),
            params,
          )
        ).status,
      ).toBe(404);
    }
    expect(database.transfer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "current-user", id: "someone-elses-transfer" },
      }),
    );
  });
  it("scopes deletion to current owner", async () => {
    expect(
      (
        await remove(
          new Request("http://localhost:3000", {
            method: "DELETE",
            headers: { origin: "http://localhost:3000" },
          }),
          params,
        )
      ).status,
    ).toBe(404);
    expect(database.transfer.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "current-user",
        id: "someone-elses-transfer",
      },
    });
  });
  it("cannot rerun another user’s transfer", async () => {
    expect(
      (
        await rerun(
          new Request("http://localhost:3000", {
            method: "POST",
            headers: { origin: "http://localhost:3000" },
          }),
          params,
        )
      ).status,
    ).toBe(400);
    expect(database.wizardState.upsert).not.toHaveBeenCalled();
  });
  it("deletes only own history and wizard", async () => {
    await removeAll(
      new Request("http://localhost:3000", {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      }),
    );
    expect(database.transfer.deleteMany).toHaveBeenCalledWith({
      where: { userId: "current-user" },
    });
    expect(database.wizardState.deleteMany).toHaveBeenCalledWith({
      where: { userId: "current-user" },
    });
  });
});

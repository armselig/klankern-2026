import { describe, expect, it, vi } from "vitest";
import {
  createVacation,
  fetchVacations,
  fetchVacationTasks,
  insertVacationTask,
  renameVacationTaskRemote,
  setVacationTaskDone,
  softDeleteVacationRemote,
  softDeleteVacationTaskRemote,
  updateVacationRemote,
  VACATION_PAGE_SIZE,
} from "./vacation-actions";
import {
  fakeClient,
  fakeClientWithQueries,
  fakeQueryBuilder,
} from "../../tests/support/fake-supabase-client";

describe.each([
  ["fetchVacations", fetchVacations, "vacations"],
  ["fetchVacationTasks", fetchVacationTasks, "vacation_tasks"],
] as const)("%s", (_name, fetchRows, table) => {
  it("returns the household's rows that are not removed", async () => {
    const rows = [{ id: "a" }, { id: "b" }];
    const query = fakeQueryBuilder({ data: rows, error: null });
    const { client, from } = fakeClientWithQueries([query]);

    expect(await fetchRows(client as never, "h1")).toEqual(rows);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith(table);
    expect(query.calls.eq).toEqual(["household_id", "h1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
    expect(query.calls.order).toEqual(["id"]);
    expect(query.calls.limit).toEqual([VACATION_PAGE_SIZE]);
    expect(query.calls.gt).toBeUndefined();
  });

  it("keeps fetching after a full page, continuing after its last id", async () => {
    const fullPage = Array.from({ length: VACATION_PAGE_SIZE }, (_, index) => ({
      id: `id-${index}`,
    }));
    const first = fakeQueryBuilder({ data: fullPage, error: null });
    const second = fakeQueryBuilder({ data: [{ id: "last" }], error: null });
    const { client, from } = fakeClientWithQueries([first, second]);

    const rows = await fetchRows(client as never, "h1");

    expect(rows).toHaveLength(VACATION_PAGE_SIZE + 1);
    expect(rows.at(-1)).toEqual({ id: "last" });
    expect(from).toHaveBeenCalledTimes(2);
    expect(second.calls.gt).toEqual(["id", `id-${VACATION_PAGE_SIZE - 1}`]);
  });

  it("returns nothing for a household without rows", async () => {
    const { client } = fakeClientWithQueries([
      fakeQueryBuilder({ data: [], error: null }),
    ]);

    expect(await fetchRows(client as never, "h1")).toEqual([]);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const { client } = fakeClientWithQueries([
      fakeQueryBuilder({ data: null, error }),
    ]);

    await expect(fetchRows(client as never, "h1")).rejects.toBe(error);
  });
});

describe("createVacation", () => {
  const vacation = {
    id: "vacation-1",
    householdId: "h1",
    title: "Winter week by the sea",
    kind: "house",
    starts_on: "2026-12-05",
    ends_on: "2026-12-12",
  } as const;
  const tasks = [
    { id: "task-1", phase: "before", title: "Clothes", position: 1 },
    { id: "task-2", phase: "during", title: "Return the key", position: 1 },
  ] as const;

  it("hands the vacation and its tasks to create_vacation in one call", async () => {
    const created = { vacation: { id: "vacation-1" }, tasks: [] };
    const rpc = vi.fn().mockResolvedValue({ data: created, error: null });
    const client = fakeClient({ rpc });

    const result = await createVacation(client as never, vacation, [...tasks]);

    expect(result).toEqual(created);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("create_vacation", {
      p_vacation: {
        id: "vacation-1",
        household_id: "h1",
        title: "Winter week by the sea",
        kind: "house",
        starts_on: "2026-12-05",
        ends_on: "2026-12-12",
      },
      p_tasks: [
        { id: "task-1", phase: "before", title: "Clothes", position: 1 },
        { id: "task-2", phase: "during", title: "Return the key", position: 1 },
      ],
    });
    // The function writes the rows itself; a second write from here could
    // succeed where the first failed, and leave half a vacation.
    expect(client.from).not.toHaveBeenCalled();
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const client = fakeClient({
      rpc: vi.fn().mockResolvedValue({ data: null, error }),
    });

    await expect(createVacation(client as never, vacation, [])).rejects.toBe(
      error,
    );
  });
});

describe("updateVacationRemote", () => {
  it("sends only the given fields, to the vacation that is not removed", async () => {
    const query = fakeQueryBuilder({
      data: [{ id: "vacation-1" }],
      error: null,
    });
    const client = fakeClient({ from: () => query.builder });

    await updateVacationRemote(client as never, "vacation-1", {
      ends_on: "2026-12-14",
    });

    expect(client.from).toHaveBeenCalledWith("vacations");
    expect(query.calls.update).toEqual([{ ends_on: "2026-12-14" }]);
    expect(query.calls.eq).toEqual(["id", "vacation-1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
  });

  it("throws when the vacation was removed in the meantime, since nothing was saved", async () => {
    const query = fakeQueryBuilder({ data: [], error: null });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      updateVacationRemote(client as never, "vacation-1", { title: "Sea" }),
    ).rejects.toThrow("This vacation was removed in the meantime.");
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      updateVacationRemote(client as never, "vacation-1", { title: "Sea" }),
    ).rejects.toBe(error);
  });
});

describe("insertVacationTask", () => {
  const task = {
    id: "task-1",
    vacationId: "vacation-1",
    householdId: "h1",
    phase: "before",
    title: "Sunscreen",
    position: 24,
  } as const;

  it("inserts with the client-supplied id and the resolved created_by", async () => {
    const row = { id: "task-1", title: "Sunscreen" };
    const query = fakeQueryBuilder({ data: row, error: null });
    const client = fakeClient({ userId: "user-1", from: () => query.builder });

    expect(await insertVacationTask(client as never, task)).toEqual(row);
    expect(client.from).toHaveBeenCalledWith("vacation_tasks");
    expect(query.calls.insert).toEqual([
      {
        id: "task-1",
        vacation_id: "vacation-1",
        household_id: "h1",
        phase: "before",
        title: "Sunscreen",
        position: 24,
        created_by: "user-1",
      },
    ]);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(insertVacationTask(client as never, task)).rejects.toBe(error);
  });
});

describe("setVacationTaskDone", () => {
  it("updates done for the given id", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    await setVacationTaskDone(client as never, "task-1", true);

    expect(client.from).toHaveBeenCalledWith("vacation_tasks");
    expect(query.calls.update).toEqual([{ done: true }]);
    expect(query.calls.eq).toEqual(["id", "task-1"]);
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      setVacationTaskDone(client as never, "task-1", true),
    ).rejects.toBe(error);
  });
});

describe("renameVacationTaskRemote", () => {
  it("sends the title to the task that is not removed", async () => {
    const query = fakeQueryBuilder({ data: [{ id: "task-1" }], error: null });
    const client = fakeClient({ from: () => query.builder });

    await renameVacationTaskRemote(client as never, "task-1", "Warm clothes");

    expect(client.from).toHaveBeenCalledWith("vacation_tasks");
    expect(query.calls.update).toEqual([{ title: "Warm clothes" }]);
    expect(query.calls.eq).toEqual(["id", "task-1"]);
    expect(query.calls.is).toEqual(["deleted_at", null]);
  });

  it("throws when the task was removed in the meantime, since nothing was saved", async () => {
    const query = fakeQueryBuilder({ data: [], error: null });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      renameVacationTaskRemote(client as never, "task-1", "Warm clothes"),
    ).rejects.toThrow("This task was removed in the meantime.");
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(
      renameVacationTaskRemote(client as never, "task-1", "Warm clothes"),
    ).rejects.toBe(error);
  });
});

describe.each([
  ["softDeleteVacationRemote", softDeleteVacationRemote, "vacations"],
  [
    "softDeleteVacationTaskRemote",
    softDeleteVacationTaskRemote,
    "vacation_tasks",
  ],
] as const)("%s", (_name, softDelete, table) => {
  it("sets deleted_at for the given id", async () => {
    const query = fakeQueryBuilder({ data: null, error: null });
    const client = fakeClient({ from: () => query.builder });

    await softDelete(client as never, "row-1");

    expect(client.from).toHaveBeenCalledWith(table);
    expect(query.calls.eq).toEqual(["id", "row-1"]);
    expect(
      typeof (query.calls.update![0] as { deleted_at: string }).deleted_at,
    ).toBe("string");
  });

  it("throws on error", async () => {
    const error = { message: "boom" };
    const query = fakeQueryBuilder({ data: null, error });
    const client = fakeClient({ from: () => query.builder });

    await expect(softDelete(client as never, "row-1")).rejects.toBe(error);
  });
});

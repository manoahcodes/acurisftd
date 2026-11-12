import { K, LEARNERS, flavour, tableOf, type Builder } from "./shared";

const hostels: Builder = (ctx) => {
  const f = flavour(ctx);
  return {
    description: `Hostels and dorm rooms at ${f.tenantName}.`,
    actions: ["Add hostel", "Add room"],
    kpis: [
      { title: "Beds", caption: "Total capacity", value: "480" },
      { title: "Occupied", caption: "This " + f.terms.period.toLowerCase(), value: "412", note: "86% occupancy" },
      { title: "Maintenance", caption: "Rooms out of service", value: "6" },
    ],
    tables: [
      tableOf("hostels",
        "Hostels & rooms",
        ["Hostel", "Block", "Gender", "Rooms", "Capacity", "Occupied", "Status"],
        [
          ["Kafue House", "A", "Female", "40", "160", "148", "Active"],
          ["Zambezi House", "B", "Male", "45", "180", "162", "Active"],
          ["Luangwa House", "C", "Female", "25", "100", "82", "Active"],
          ["Kariba House", "D", "Male", "10", "40", "20", "Maintenance"],
        ],
        { statusColumn: "Status" },
      ),
      tableOf("rooms",
        "Rooms",
        ["Room", "Hostel", "Beds", "Status"],
        [
          ["A-101", "Kafue House", "4", "Active"],
          ["A-102", "Kafue House", "4", "Active"],
          ["B-201", "Zambezi House", "4", "Active"],
          ["D-001", "Kariba House", "4", "Maintenance"],
        ],
        { statusColumn: "Status", note: "Add a room with the Add room button. Rooms are listed here; hostel totals above are set when a hostel is edited." },
      ),
    ],
  };
};

const allocations: Builder = (ctx) => {
  const f = flavour(ctx);
  const houses = ["Kafue House", "Zambezi House", "Luangwa House", "Zambezi House", "Kafue House", "Luangwa House"];
  return {
    description: "Room allocations for the current period.",
    actions: ["Allocate room"],
    tables: [
      tableOf("allocations",
        "Room allocations",
        ["Student", "Hostel", "Room", f.terms.period, "Fee", "Status"],
        LEARNERS.slice(0, 6).map((l, i) => [
          `${l.no} · ${l.name}`,
          houses[i],
          `A-${100 + i * 7}`,
          f.periodName(f.tertiary ? 2 : 3),
          K(3200),
          i === 3 ? "Waitlisted" : i === 5 ? "Pending" : "Allocated",
        ]),
        { statusColumn: "Status" },
      ),
    ],
  };
};

export const hostelScreens: Record<string, Builder> = {
  "hostels/hostels-and-rooms": hostels,
  "hostels/room-allocations": allocations,
};

import fs from "fs";
import { json2csv } from "json-2-csv";
import { getIpLocations, LoginEventsBreakdown, formatLoginEventsBreakdownAsCsv } from "./functions/helper.js";


// Create Folders
if(!fs.existsSync("./startingData")) {
  fs.mkdirSync("./startingData");
}
if(!fs.existsSync("./results")) {
  fs.mkdirSync("./results");
}

import loginEvents from "./startingData/login_events.json" assert { type: "json" };

async function main(loginEvents) {
  const file = [];
  const ipLocations = await getIpLocations(loginEvents);

  const ipLocationMap = ipLocations.reduce((map, location) => {
    map[location.query] = location;
    return map;
  }, {});

  for (const login of loginEvents) {
    const ipLocation = ipLocationMap[login?.ClientIP ?? null] || {};
    file.push({
      UserId: login?.UserId ?? "",
      ClientIP: login?.ClientIP ?? "",
      CreationTime: login?.CreationTime ?? "",
      ResultStatus: login?.ResultStatus ?? "",
      Operation: login?.Operation ?? "",
      country: ipLocation?.country ?? "",
      region: ipLocation?.regionName ?? "",
      city: ipLocation?.city ?? "",
      isp: ipLocation?.isp ?? "",
      error: ipLocation?.error ?? "",
    });
  }

  const breakDownDataJson = LoginEventsBreakdown(file);
  const breakDownDataCsv = formatLoginEventsBreakdownAsCsv(breakDownDataJson);
  const csv = await json2csv(file, {});

  fs.writeFileSync("./results/login_events.csv", csv);
  fs.writeFileSync("./results/login_events_breakdown.csv", breakDownDataCsv);
  fs.writeFileSync("./results/login_events_breakdown.json", JSON.stringify(breakDownDataJson, null, 2));
}
// ----------------------------------End Main Function-----------------------------------

// ----------------------------------Execute the main function-----------------------------------
(async () => await main(loginEvents))();

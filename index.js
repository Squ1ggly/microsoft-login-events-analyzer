const fs = require("fs"); // File system for writing files
const fetch = require("isomorphic-fetch"); // isomorphic-fetch, cuz I'm used to it
const converter = require("json-2-csv"); // To convert the json to csv

/**
   ______     __     ________     __                     __  _                 
  / ____/__  / /_   /  _/ __ \   / /   ____  _________ _/ /_(_)___  ____  _____
 / / __/ _ \/ __/   / // /_/ /  / /   / __ \/ ___/ __ `/ __/ / __ \/ __ \/ ___/
/ /_/ /  __/ /_   _/ // ____/  / /___/ /_/ / /__/ /_/ / /_/ / /_/ / / / (__  ) 
\____/\___/\__/  /___/_/      /_____/\____/\___/\__,_/\__/_/\____/_/ /_/____/  
 */

// ----------------------------------Start of helpers-----------------------------------

function removeDuplicateValues(strArr) {
  const foundSet = new Set();
  for (const str of strArr) {
    foundSet.add(str);
  }
  return Array.from(foundSet);
}

async function batchSearchIPAdd(query) {
  const batchSize = 25;
  const batchCount = Math.ceil(query.length / batchSize);
  const returnArray = [];

  for (let i = 0; i < batchCount; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, query.length);

    const batch = query.slice(start, end);

    const res = await fetch("http://ip-api.com/batch", {
      "Content-Type": "application/json",
      method: "POST",
      body: JSON.stringify(batch),
    });

    if (res.ok) {
      const json = await res.json();
      returnArray.push(...json);
      continue;
    }
    const resText = await res.text();
    returnArray.push({ error: resText });
  }
  return returnArray;
}

async function getIpLocations(loginEvents) {
  const ips = loginEvents.map((e) => e.ClientIP);
  const uniqueIPs = removeDuplicateValues(ips);

  const querys = uniqueIPs.map((e) => {
    return { query: e };
  });

  const removeGarbageIps = querys.filter((e) => !!e.query);
  return await batchSearchIPAdd(removeGarbageIps);
}

function loginEventsBreakdown(LoginEvents) {
  const returnValue = {
    total_number_of_logins: LoginEvents.length,
    user_info: {},
  };
  for (const login of LoginEvents) {
    if (!returnValue.user_info[login.UserId]) {
      returnValue.user_info[login.UserId] = {
        number_of_logins: 0,
        login_locations: new Map(),
      };
    }
    returnValue.user_info[login.UserId].number_of_logins += 1;
    const locationKey = login.city;
    let locationData = returnValue.user_info[login.UserId].login_locations.get(locationKey);
    if (!locationData) {
      locationData = {
        country: login.country,
        region: login.region,
        city: login.city,
        number_of_logins: 0,
      };
    }
    locationData.number_of_logins += 1;
    returnValue.user_info[login.UserId].login_locations.set(locationKey, locationData);
  }

  for (const userId in returnValue.user_info) {
    const user = returnValue.user_info[userId];
    user.login_locations = Array.from(user.login_locations.values());
  }

  return returnValue;
}

function formatLoginEventsBreakdownAsCsv(data) {
  let csv = "";
  csv += "User Email,Number of Logins\n";
  for (const [userEmail, user] of Object.entries(data.user_info)) {
    const numLogins = user.number_of_logins;
    csv += `${userEmail},${numLogins}\n`;
    for (const location of user.login_locations) {
      const country = location.country;
      const region = location.region;
      const city = location.city;
      const numLocationLogins = location.number_of_logins;
      csv += `,${country},${region},${city},${numLocationLogins}\n`;
    }
  }
  return csv;
}

// ----------------------------------End of helpers-----------------------------------

// ----------------------------------Start Main Function-----------------------------------

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

  const breakDownDataJson = loginEventsBreakdown(file);
  const breakDownDataCsv = formatLoginEventsBreakdownAsCsv(breakDownDataJson);
  const csv = await converter.json2csv(file, {});

  fs.writeFileSync("./results/login_events.csv", csv);
  fs.writeFileSync("./results/login_events_breakdown.csv", breakDownDataCsv);
  fs.writeFileSync("./results/login_events_breakdown.json", JSON.stringify(breakDownDataJson, null, 2));
}
// ----------------------------------End Main Function-----------------------------------

// ----------------------------------Execute the main function-----------------------------------
(async () => await main(loginEvents))();

const fs = require("fs"); // File system for writing files
const fetch = require("isomorphic-fetch"); // isomorphic-fetch, cuz I'm used to it
const converter = require("json-2-csv"); // To convert the json to csv

// Initialize Project, make sure we are ready to continue
try {
  fs.mkdirSync("./startingData");
} catch (err) {
  console.log("Directory already exists, continuing");
}

// Check if the data file exists
if (!fs.existsSync("./startingData/login_events.json")) {
  console.log("Please input login events");
  return;
}
const loginEvents = require("./startingData/login_events.json"); // This file should be the extracted microsoft login events from the Compliance center

/**
   ______     __     ________     __                     __  _                 
  / ____/__  / /_   /  _/ __ \   / /   ____  _________ _/ /_(_)___  ____  _____
 / / __/ _ \/ __/   / // /_/ /  / /   / __ \/ ___/ __ `/ __/ / __ \/ __ \/ ___/
/ /_/ /  __/ /_   _/ // ____/  / /___/ /_/ / /__/ /_/ / /_/ / /_/ / / / (__  ) 
\____/\___/\__/  /___/_/      /_____/\____/\___/\__,_/\__/_/\____/_/ /_/____/  
 */

// ----------------------------------Start of helpers-----------------------------------
/**
 * This function removed duplicate values in a string array
 * @param {string[]} strArr The string array you want to deduplicated
 * @returns A new string array of the deduplicated values
 */
function removeDuplicateValues(strArr) {
  const foundSet = new Set();
  for (const str of strArr) {
    foundSet.add(str);
  }
  return Array.from(foundSet);
}

/**
 * This function takes an array of query ip addresses to return with location and other data
 * Check out the https://ip-api.com/docs for more info about what the heck is happening here
 * @param {query[]} query This is the query objects from
 * @returns
 */
async function batchSearchIPAdd(query) {
  const batchSize = 25; // The size of the batches to smash the api with
  const batchCount = Math.ceil(query.length / batchSize); // The total number of batches we are gonna make
  const returnArray = []; // The return array of ip locations

  // Get ip locations for batches
  for (let i = 0; i < batchCount; i++) {
    const start = i * batchSize; // The start of the batch for each
    const end = Math.min(start + batchSize, query.length); // The end of the batch
    const batch = query.slice(start, end); // Slice the array so we have the current batch

    // Post to the api to get locations
    const res = await fetch("http://ip-api.com/batch", {
      "Content-Type": "application/json",
      method: "POST",
      body: JSON.stringify(batch),
    });

    if (res.ok) {
      // Check the response was ok from the api
      const json = await res.json();
      returnArray.push(...json); // Push array into return array
    } else {
      // Else we push the error
      const resText = await res.text();
      returnArray.push({ error: resText });
    }
  }

  return returnArray;
}

/**
 * This function takes the login events exported from the microsoft compliance center
 * @param {Microsoft Login Events} loginEvents Exported microsoft login events from your tenant
 * @returns An array of IP Address locations
 */
async function getIpLocations(loginEvents) {
  const ips = loginEvents.map((e) => e.ClientIP); // Extract the ips from the array of login events
  const uniqueIPs = removeDuplicateValues(ips); // Remove the duplicate ip addresses

  // Return array of query objects for use with the batchSearchIPAdd function
  const querys = uniqueIPs.map((e) => {
    return { query: e };
  });

  // removes all the trash falsy values from the querys array
  const removeGarbageIps = querys.filter((e) => !!e.query);
  // This will return the ip addresses with locations
  return await batchSearchIPAdd(removeGarbageIps);
}
// ----------------------------------End of helpers-----------------------------------

// ----------------------------------Start Main Function-----------------------------------
async function ConvertLoginEventsToCSV(loginEvents) {
  const file = [];
  const ipLocations = await getIpLocations(loginEvents);

  const ipLocationMap = ipLocations.reduce((map, location) => {
    map[location.query] = location;
    return map;
  }, {});

  // Filter out garbage from loginEvents and add location data
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

  const csv = await converter.json2csv(file, {});

  try {
    fs.mkdirSync("./results");
  } catch (err) {
    console.log("Directory already exists, continuing");
  }
  fs.writeFileSync("./results/login_events.csv", csv);
}
// ----------------------------------End Main Function-----------------------------------

// ----------------------------------Execute the main function-----------------------------------
(async () => await ConvertLoginEventsToCSV(loginEvents))();

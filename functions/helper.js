import fetch from "node-fetch";

/**
 * Takes an array of strings
 * @param {string[]} strArr
 * @returns A new array of the unique set of strings
 */
export function removeDuplicateValues(strArr) {
  const foundSet = new Set();
  for (const str of strArr) {
    foundSet.add(str);
  }
  return Array.from(foundSet);
}

/**
 * Takes an array of ip addresses
 * @param {string[]} ipAddresses
 * @returns An array of objects that contain the IPs and the location data assigned to it
 */
export async function batchFetchData(ipAddresses) {
  const batchSize = 25;
  const batchCount = Math.ceil(ipAddresses.length / batchSize);
  const ipLocations = [];

  for (let i = 0; i < batchCount; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, ipAddresses.length);

    const batch = ipAddresses.slice(start, end);

    const res = await fetch("http://ip-api.com/batch", {
      "Content-Type": "application/json",
      method: "POST",
      body: JSON.stringify(batch),
    });

    if (res.ok) {
      const json = await res.json();
      ipLocations.push(...json);
      continue;
    }
    const resText = await res.text();
    ipLocations.push({ error: resText });
  }
  return ipLocations;
}

/**
 * This function takes an array of Microsoft Compliance Login Events
 * @param {object[]} LoginEvents
 * @returns An array of objects that contain the IPs and the location data assigned to it
 */
export async function getIpLocations(LoginEvents) {
  const ipAddresses = LoginEvents.reduce((prev, curr) => {
    if (!prev.includes(curr.ClientIP)) {
      prev.push(curr.ClientIP);
    }
    return prev;
  }, []);
  return await batchFetchData(ipAddresses);
}

// Not sure what to do with these.
/**
 * This function takes an array of Microsoft Compliance Login Events
 * @param {object[]} LoginEvents
 * @returns A structured array
 */
export function loginEventsBreakdown(LoginEvents) {
  const breakDown = {
    total_number_of_logins: LoginEvents.length,
    user_info: {},
  };
  for (const login of LoginEvents) {
    if (!breakDown.user_info[login.UserId]) {
      breakDown.user_info[login.UserId] = {
        number_of_logins: 0,
        login_locations: new Map(),
      };
    }

    breakDown.user_info[login.UserId].number_of_logins += 1;

    const locationKey = login.city;
    let locationData = breakDown.user_info[login.UserId].login_locations.get(locationKey);
    if (!locationData) {
      locationData = {
        country: login.country,
        region: login.region,
        city: login.city,
        number_of_logins: 0,
      };
    }

    locationData.number_of_logins += 1;

    breakDown.user_info[login.UserId].login_locations.set(locationKey, locationData);
  }

  for (const userId in breakDown.user_info) {
    const user = breakDown.user_info[userId];
    user.login_locations = Array.from(user.login_locations.values());
  }

  return breakDown;
}

/**
 * This function takes the output of the LoginEventsBreakdown, the function is required for the unique shape of the data structure.
 * @param {object[]} data
 * @returns A specialized format CSV string.
 */
export function formatLoginEventsBreakdownAsCsv(data) {
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

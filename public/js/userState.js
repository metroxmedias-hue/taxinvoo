let currentUserData = null;

export function setUserData(data) {
  currentUserData = data && typeof data === "object" ? { ...data } : null;
  if (typeof window !== "undefined") {
    window.__metroxUserData = currentUserData;
  }
}

export function getUserData() {
  if (currentUserData && typeof currentUserData === "object") {
    return currentUserData;
  }
  if (typeof window !== "undefined" && window.__metroxUserData && typeof window.__metroxUserData === "object") {
    return window.__metroxUserData;
  }
  return null;
}

if (typeof window !== "undefined") {
  window.setUserData = setUserData;
  window.getUserData = getUserData;
}

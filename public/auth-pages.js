const AUTH_TOKEN_KEY = "jimms-part-picker-auth-token";
const THEME_KEY = "jimms-part-picker-theme";

const pageMode = document.body.dataset.authPage || "";
const statusEl = document.querySelector("#authPageStatus");

function setTheme(theme) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}

function loadTheme() {
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    setTheme(stored);
    return;
  }
  setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function setStatus(message = "", tone = "") {
  if (!statusEl) return;
  statusEl.textContent = message;
  if (tone) {
    statusEl.dataset.tone = tone;
  } else {
    delete statusEl.dataset.tone;
  }
}

function redirectHome() {
  window.location.href = "/";
}

async function postJson(url, payload, authToken = "") {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.message || "Request failed.");
  }
  return data;
}

function setupRegisterPage() {
  const form = document.querySelector("#registerForm");
  const usernameInput = document.querySelector("#registerUsernameInput");
  const emailInput = document.querySelector("#registerEmailInput");
  const passwordInput = document.querySelector("#registerPasswordInput");
  const confirmInput = document.querySelector("#registerConfirmPasswordInput");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (passwordInput.value !== confirmInput.value) {
      setStatus("Passwords do not match.", "warn");
      return;
    }

    try {
      const data = await postJson("/api/auth/local/register", {
        username: usernameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value
      });
      window.localStorage.setItem(AUTH_TOKEN_KEY, data.token || "");
      setStatus(data.message || "Account created.", "ok");
      setTimeout(redirectHome, 500);
    } catch (error) {
      setStatus(error.message || "Could not create that account.", "warn");
    }
  });
}

function setupLoginPage() {
  const form = document.querySelector("#loginForm");
  const emailInput = document.querySelector("#loginEmailInput");
  const passwordInput = document.querySelector("#loginPasswordInput");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const data = await postJson("/api/auth/local/login", {
        email: emailInput.value.trim(),
        password: passwordInput.value
      });
      window.localStorage.setItem(AUTH_TOKEN_KEY, data.token || "");
      setStatus(data.message || "Signed in.", "ok");
      setTimeout(redirectHome, 400);
    } catch (error) {
      setStatus(error.message || "Could not sign in.", "warn");
    }
  });
}

function setupForgotPage() {
  const form = document.querySelector("#forgotForm");
  const emailInput = document.querySelector("#forgotEmailInput");
  const codeInput = document.querySelector("#resetCodeInput");
  const passwordInput = document.querySelector("#resetPasswordInput");
  const confirmInput = document.querySelector("#resetConfirmPasswordInput");
  const requestResetButton = document.querySelector("#requestResetButton");

  requestResetButton?.addEventListener("click", async () => {
    try {
      const data = await postJson("/api/auth/local/forgot-password", {
        email: emailInput.value.trim()
      });
      setStatus(data.message || "Reset email sent.", "ok");
    } catch (error) {
      setStatus(error.message || "Could not start password reset.", "warn");
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (passwordInput.value !== confirmInput.value) {
      setStatus("Passwords do not match.", "warn");
      return;
    }

    try {
      const data = await postJson("/api/auth/local/reset-password", {
        email: emailInput.value.trim(),
        code: codeInput.value.trim(),
        password: passwordInput.value
      });
      setStatus(data.message || "Password updated. Sign in now.", "ok");
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 700);
    } catch (error) {
      setStatus(error.message || "Could not reset password.", "warn");
    }
  });
}

loadTheme();

if (pageMode === "register") {
  setupRegisterPage();
} else if (pageMode === "login") {
  setupLoginPage();
} else if (pageMode === "forgot") {
  setupForgotPage();
}

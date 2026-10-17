// Contact form: client-side checks for fast feedback, then POST /api/contact.
// The server validates again; it is the source of truth.
import { animate } from "./vendor/anime.esm.min.js";
import { qs, qsa } from "./lib/dom.js";

const FIELDS = ["name", "email", "phone", "organization", "message"];
const FALLBACK = "Text (405) 984-7036 or email domingueztechsolutions@gmail.com instead.";

const MESSAGES = {
  required: "This field is required.",
  too_short: "This is too short.",
  too_long: "This is too long.",
  invalid_format: "Check this value.",
};

const FIELD_MESSAGES = {
  "email:invalid_format": "Enter an email address like name@example.com.",
  "phone:invalid_format": "Use digits, spaces, dashes or parentheses.",
  "message:too_short": "Tell me a little more, at least 10 characters.",
};

/** Pure: an error code for a field -> the sentence shown to the person. */
export function messageFor(field, code) {
  return FIELD_MESSAGES[`${field}:${code}`] ?? MESSAGES[code] ?? MESSAGES.invalid_format;
}

/** Pure: form values -> field error codes, mirroring the server rules. */
export function checkFields(values) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = values.name.trim() === "" ? "required" : "too_short";
  if (values.email.trim() === "") errors.email = "required";
  else if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(values.email.trim())) errors.email = "invalid_format";
  if (values.phone.trim() !== "" && !/^[0-9+()\-.\s]{7,30}$/.test(values.phone.trim())) errors.phone = "invalid_format";
  if (values.message.trim() === "") errors.message = "required";
  else if (values.message.trim().length < 10) errors.message = "too_short";
  return errors;
}

/** Pure: an API response -> what the form should show. */
export function outcomeFor(status, body, retryAfter) {
  if (status === 201) return { kind: "success", text: "Message sent. I'll reply within one business day." };
  if (status === 422 && body && typeof body.fields === "object") {
    return { kind: "fields", fields: body.fields, text: "Some fields need a fix before this can send." };
  }
  if (status === 429) {
    const minutes = Math.max(1, Math.ceil(Number(retryAfter || 600) / 60));
    return { kind: "error", text: `Too many messages from this connection. Try again in ${minutes} minutes, or ${FALLBACK.charAt(0).toLowerCase()}${FALLBACK.slice(1)}` };
  }
  return { kind: "error", text: `The message didn't send. ${FALLBACK}` };
}

function readValues(form) {
  const data = new FormData(form);
  const value = (key) => String(data.get(key) ?? "");
  return { ...Object.fromEntries(FIELDS.map((key) => [key, value(key)])), website: value("website") };
}

function showFieldErrors(form, errors) {
  FIELDS.forEach((field) => {
    const input = form.elements.namedItem(field);
    const slot = qs(`[data-error-for="${field}"]`, form);
    const code = errors[field];
    slot.textContent = code ? messageFor(field, code) : "";
    if (code) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  });
  const first = FIELDS.find((field) => errors[field]);
  if (first) form.elements.namedItem(first).focus();
}

function showStatus(status, kind, text) {
  status.textContent = text;
  status.classList.toggle("is-success", kind === "success");
  status.classList.toggle("is-error", kind !== "success");
  animate(status, { opacity: [0, 1], translateY: [6, 0], duration: 500, ease: "outExpo" });
}

async function send(values) {
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(values),
      credentials: "same-origin",
    });
    const body = await response.json().catch(() => null);
    return outcomeFor(response.status, body, response.headers.get("Retry-After"));
  } catch {
    return outcomeFor(0, null, null);
  }
}

export function initContact() {
  const form = qs("[data-contact-form]");
  if (form === null) return;
  const submit = qs("[data-submit]", form);
  const status = qs("[data-form-status]", form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = readValues(form);
    const errors = checkFields(values);
    showFieldErrors(form, errors);
    if (Object.keys(errors).length > 0) return;

    submit.disabled = true;
    submit.textContent = "Sending…";
    const outcome = await send(values);
    submit.disabled = false;
    submit.textContent = "Send message";

    if (outcome.kind === "fields") showFieldErrors(form, outcome.fields);
    if (outcome.kind === "success") form.reset();
    showStatus(status, outcome.kind, outcome.text);
  });

  qsa("input, textarea", form).forEach((input) => input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") !== "true") return;
    input.removeAttribute("aria-invalid");
    const slot = qs(`[data-error-for="${input.name}"]`, form);
    if (slot !== null) slot.textContent = "";
  }));
}

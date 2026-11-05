import "../components/navbar.js";
import { api } from "../core/api.js";
import { byId } from "../core/dom.js";

const form = byId("supportContactForm");
const result = byId("supportSubmitMessage");
const submit = byId("supportSubmitBtn");

function showResult(text, success) {
  result.textContent = text;
  result.className = `acik ${success ? "destek-basarili" : "destek-hatali"}`;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.className = "";
  result.textContent = "";
  submit.disabled = true;
  submit.textContent = "Gönderiliyor...";

  try {
    const { message, request } = await api("/api/support", {
      method: "POST",
      body: {
        fullName: byId("supportName").value.trim(),
        email: byId("supportEmail").value.trim(),
        phone: byId("supportPhone").value.trim(),
        message: byId("supportMessage").value.trim()
      }
    });
    showResult(`${message} Talep numaranız: #${request.id}`, true);
    form.reset();
  } catch (error) {
    showResult(error.message, false);
  } finally {
    submit.disabled = false;
    submit.textContent = "Gönder";
  }
});

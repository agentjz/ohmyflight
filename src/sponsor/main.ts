import { siteVisibility } from "../site-visibility";
import { contributors } from "./contributors";

document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copy || "";
    if (!value) return;
    try {
      await copyText(value);
      button.textContent = "已复制";
      window.setTimeout(() => {
        button.textContent = "复制";
      }, 1400);
    } catch {
      button.textContent = "复制失败";
    }
  });
});

renderContributors();

function renderContributors(): void {
  const container = document.getElementById("contributorsList");
  const title = document.getElementById("contributorsTitle");
  const count = document.getElementById("contributorsCount");
  const labels = contributors.labels;
  const empty = container?.querySelector(".contributors-empty");
  if (title) title.textContent = labels.title;
  if (count) count.textContent = labels.pendingCount;
  if (empty) empty.textContent = labels.emptyMessage;
  if (!container || siteVisibility.sponsorPage.contributors !== true) return;

  const people = contributors.people.filter((person) => person.name && person.contribution);
  if (!people.length) return;
  if (count) count.textContent = labels.countTemplate.replace("{count}", String(people.length));

  const list = document.createElement("ul");
  list.className = "contributors-people";
  people.forEach((person) => {
    const item = document.createElement("li");
    item.className = "contributors-person";
    const linkUrl = safeHttpUrl(person.linkUrl);
    const avatarLink = document.createElement(linkUrl ? "a" : "span");
    avatarLink.className = "contributors-avatar-link";
    if (avatarLink instanceof HTMLAnchorElement) {
      avatarLink.href = linkUrl;
      avatarLink.target = "_blank";
      avatarLink.rel = "noopener noreferrer";
    }
    const avatar = document.createElement("img");
    avatar.className = "contributors-avatar";
    avatar.src = safeHttpUrl(person.avatarUrl) || "./assets/contributor-anonymous.svg";
    avatar.alt = `${person.name}的头像`;
    avatar.width = 52;
    avatar.height = 52;
    avatar.loading = "lazy";
    avatar.addEventListener("error", () => {
      avatar.src = "./assets/contributor-anonymous.svg";
    }, { once: true });
    avatarLink.append(avatar);
    const name = document.createElement(linkUrl ? "a" : "span");
    name.className = "contributors-name";
    name.textContent = person.name;
    if (name instanceof HTMLAnchorElement) {
      name.href = linkUrl;
      name.target = "_blank";
      name.rel = "noopener noreferrer";
    }
    const description = document.createElement("p");
    description.className = "contributors-description";
    description.textContent = person.contribution;
    item.append(avatarLink, name, description);
    list.append(item);
  });
  container.replaceChildren(list);
}

function safeHttpUrl(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy failed");
}

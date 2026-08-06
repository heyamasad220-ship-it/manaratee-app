const fs = require("fs")

const raw = fs.readFileSync("C:/Users/danan/Downloads/BazaarVendors.csv", "utf8")

function parseCSV(text) {
  const rows = []
  let row = []
  let cur = ""
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const n = text[i + 1]
    if (q) {
      if (c === '"' && n === '"') {
        cur += '"'
        i++
      } else if (c === '"') {
        q = false
      } else {
        cur += c
      }
    } else if (c === '"') {
      q = true
    } else if (c === ",") {
      row.push(cur)
      cur = ""
    } else if (c === "\n" || (c === "\r" && n === "\n")) {
      if (c === "\r") i++
      row.push(cur)
      rows.push(row)
      row = []
      cur = ""
    } else if (c !== "\r") {
      cur += c
    }
  }
  if (cur.length || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}

const rows = parseCSV(raw.replace(/^\uFEFF/, ""))
const header = rows[0]
const data = rows.slice(1).filter((r) => r.some((c) => String(c).trim()))
const idx = Object.fromEntries(header.map((h, i) => [h, i]))

function get(r, name) {
  return (r[idx[name]] || "").trim()
}

function first(r, names) {
  for (const n of names) {
    const v = get(r, n)
    if (v) return v
  }
  return ""
}

const bizNames = [
  "What is the name of your business?",
  "What is your business name?",
  "what is your business name?",
]
const sellingNames = [
  "What Are you selling?",
  "What are you selling?",
  "What products are you selling?(details please)",
]
const socialNames = [
  "Do you have a website or/and social media for your business? please listed below?",
  "Do you have a website or social media for your business?",
  "Please share your social media addresses, e.g. Facebook, Instagram, etc.",
  "What is the link to your business if applicable?",
  "Do you have a website or social media account?",
]

const events = new Map()
const emails = new Map()
const payments = new Map()
const descriptions = new Map()
const methods = new Map()
let missingEmail = 0
let withBiz = 0
let withSelling = 0
let withSocial = 0
const samplePreview = []

for (const r of data) {
  const event = get(r, "Event name") || "(none)"
  const start = get(r, "Event start")
  const key = `${event} || ${start}`
  events.set(key, (events.get(key) || 0) + 1)

  const email = get(r, "Email").toLowerCase()
  if (!email) missingEmail++
  else emails.set(email, (emails.get(email) || 0) + 1)

  const amt = get(r, "Value")
  payments.set(amt, (payments.get(amt) || 0) + 1)

  const desc = get(r, "Description")
  descriptions.set(desc, (descriptions.get(desc) || 0) + 1)

  const method = get(r, "Payment method")
  methods.set(method, (methods.get(method) || 0) + 1)

  const biz = first(r, bizNames)
  if (biz) withBiz++
  const sell = first(r, sellingNames)
  if (sell) withSelling++
  const social = first(r, socialNames)
  if (social) withSocial++

  if (samplePreview.length < 8) {
    samplePreview.push({
      event,
      start,
      description: desc,
      amount: amt,
      method,
      name: get(r, "Name"),
      email: get(r, "Email"),
      phone: get(r, "Mobile number"),
      business: biz || null,
      selling: sell || null,
      city: get(r, "Address 2"),
      state: get(r, "Address 3"),
    })
  }
}

const multiEmail = [...emails.entries()].filter(([, n]) => n > 1).length

console.log(
  JSON.stringify(
    {
      columns: header.length,
      dataRows: data.length,
      uniqueEmails: emails.size,
      missingEmail,
      emailsOnMultipleRows: multiEmail,
      withBusinessName: withBiz,
      withSelling: withSelling,
      withSocial: withSocial,
      events: [...events.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => ({ count: n, key: k })),
      paymentAmounts: [...payments.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([k, n]) => ({ amount: k, count: n })),
      descriptions: [...descriptions.entries()].map(([k, n]) => ({
        label: k,
        count: n,
      })),
      paymentMethods: [...methods.entries()].map(([k, n]) => ({
        method: k,
        count: n,
      })),
      repeatedQuestionGroups: {
        businessName: bizNames,
        selling: sellingNames,
        social: socialNames,
      },
      samplePreview,
    },
    null,
    2
  )
)

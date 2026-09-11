// A tiny fake of the subset of Mongoose's query API our services rely on.
// This is NOT a general-purpose mock — it exists so we can exercise real
// business logic (wallet safety, pricing priority, idempotency) with zero
// external dependencies, since this sandbox has no network access to
// install mongoose/jest/mongodb-memory-server.

let seq = 1;
const oid = () => `fakeid_${seq++}`;

function matches(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      if ("$gte" in cond) return doc[key] >= cond.$gte;
      if ("$type" in cond) return typeof doc[key] === cond.$type || (cond.$type === "string" && typeof doc[key] === "string");
    }
    return doc[key] === cond;
  });
}

function applyUpdate(doc, update) {
  if (update.$inc) {
    for (const [k, v] of Object.entries(update.$inc)) {
      doc[k] = (doc[k] || 0) + v;
    }
  }
  if (update.$set) {
    Object.assign(doc, update.$set);
  }
  return doc;
}

function makeFakeModel(initialDocs = []) {
  const store = initialDocs.map((d) => ({ ...d, _id: d._id || oid() }));

  class Doc {
    constructor(data) {
      Object.assign(this, data);
    }
    async save() {
      const idx = store.findIndex((d) => d._id === this._id);
      const plain = { ...this };
      delete plain.save;
      if (idx >= 0) store[idx] = plain;
      else store.push(plain);
      return this;
    }
  }

  return {
    _store: store,
    async findOne(filter = {}) {
      const found = store.find((d) => matches(d, filter));
      return found ? new Doc(found) : null;
    },
    async findById(id) {
      const found = store.find((d) => d._id === id);
      return found ? new Doc(found) : null;
    },
    async findOneAndUpdate(filter, update, opts = {}) {
      const found = store.find((d) => matches(d, filter));
      if (!found) return null;
      applyUpdate(found, update);
      return opts.new ? new Doc(found) : found;
    },
    async create(data) {
      // simulate unique index violations the way Mongo would (E11000)
      if (this._uniqueCheck && this._uniqueCheck(store, data)) {
        const err = new Error("duplicate key");
        err.code = 11000;
        throw err;
      }
      const doc = { ...data, _id: oid(), createdAt: new Date() };
      store.push(doc);
      return new Doc(doc);
    },
    async countDocuments(filter = {}) {
      return store.filter((d) => matches(d, filter)).length;
    },
    async updateOne(filter, update) {
      const found = store.find((d) => matches(d, filter));
      if (found) applyUpdate(found, update);
      return { acknowledged: true };
    },
  };
}

module.exports = { makeFakeModel, oid };

const proxy = new Proxy(process.stdout, {
  get(target, property, receiver) {
    return Reflect.get(target, property, receiver);
  }
});
console.log("rows from stdout:", process.stdout.rows);
console.log("rows from proxy:", proxy.rows);

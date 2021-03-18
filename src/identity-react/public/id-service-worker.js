/**
 * 2021-3-2
 *
 * Credit to this helpful _how to_:
 *
 * https://kelvinmwinuka.com/easy-workbox-integration-with-create-react-app/
 */
importScripts('/workbox-v6.1.1/workbox-sw.js')

if (workbox) {
  console.log(`Yay! Workbox is loaded 🎉`);
  workbox.setConfig({
    modulePathPrefix: '/workbox/workbox-v6.1.1/'
  });
} else {
  console.log(`Boo! Workbox didn't load 😬`);
}

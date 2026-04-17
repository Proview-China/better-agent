import SwiftUI

@main
struct PraxisDemoHostApp: App {
  var body: some Scene {
    WindowGroup("Praxis Demo Host", id: "demo-host") {
      DemoHostRootView(client: PraxisDemoHostClient())
    }
  }
}

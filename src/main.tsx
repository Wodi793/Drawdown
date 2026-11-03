import { render } from "preact";
import { init } from "./data/store";
import { App } from "./ui/App";
import { watchScreen } from "./ui/screen";
import "./ui/styles.css";

render(<App />, document.getElementById("root")!);
void init();
watchScreen();

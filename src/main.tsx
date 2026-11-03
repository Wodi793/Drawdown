import { render } from "preact";
import { init } from "./data/store";
import { App } from "./ui/App";
import "./ui/styles.css";

render(<App />, document.getElementById("root")!);
void init();

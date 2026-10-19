// Injected into the page's MAIN world at document_start (manifest "world": "MAIN").
import { installTap, type TapWindow } from './tap';

installTap(window as unknown as TapWindow);

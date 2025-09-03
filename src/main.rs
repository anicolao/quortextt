#![warn(clippy::all, rust_2018_idioms)]
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")] // hide console window on Windows in release

#[cfg(not(target_arch = "wasm32"))]
use clap::Parser;

#[cfg(not(target_arch = "wasm32"))]
#[derive(Parser)]
#[command(name = "flows")]
#[command(about = "A tile-placing game")]
struct Args {
    /// Enable AI debugging output
    #[arg(long, default_value_t = false)]
    ai_debugging: bool,

    /// Enable debug animations slowdown. Takes optional factor (default: 10.0)
    #[arg(long, value_name = "FACTOR")]
    debug_animations_slowdown: Option<Option<f32>>,
}

// When compiling natively:
#[cfg(not(target_arch = "wasm32"))]
fn main() -> eframe::Result {
    let args = Args::parse();

    // Process debug animations slowdown argument
    let animation_slowdown = match args.debug_animations_slowdown {
        Some(Some(factor)) => factor, // --debug-animations-slowdown=X
        Some(None) => 10.0,           // --debug-animations-slowdown (no value)
        None => 1.0,                  // not specified
    };

    #[cfg(feature = "gui")]
    env_logger::init(); // Log to stderr (if you run with `RUST_LOG=debug`).

    let native_options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([400.0, 300.0])
            .with_min_inner_size([300.0, 220.0])
            .with_icon(
                // NOTE: Adding an icon is optional
                eframe::icon_data::from_png_bytes(&include_bytes!("../assets/icon-256.png")[..])
                    .expect("Failed to load icon"),
            ),
        ..Default::default()
    };
    eframe::run_native(
        "Flows",
        native_options,
        Box::new(move |cc| {
            Ok(Box::new(flows::FlowsApp::new_with_debugging(
                cc,
                args.ai_debugging,
                animation_slowdown,
            )))
        }),
    )
}

// When compiling to web using trunk:
#[cfg(target_arch = "wasm32")]
fn main() {
    use eframe::wasm_bindgen::JsCast as _;

    // Redirect `log` message to `console.log` and friends:
    eframe::WebLogger::init(log::LevelFilter::Debug).ok();

    let web_options = eframe::WebOptions::default();

    wasm_bindgen_futures::spawn_local(async {
        let document = web_sys::window()
            .expect("No window")
            .document()
            .expect("No document");

        let canvas = document
            .get_element_by_id("the_canvas_id")
            .expect("Failed to find the_canvas_id")
            .dyn_into::<web_sys::HtmlCanvasElement>()
            .expect("the_canvas_id was not a HtmlCanvasElement");

        let start_result = eframe::WebRunner::new()
            .start(
                canvas,
                web_options,
                Box::new(|cc| Ok(Box::new(flows::FlowsApp::new(cc)))),
            )
            .await;

        // Remove the loading text and spinner:
        if let Some(loading_text) = document.get_element_by_id("loading_text") {
            match start_result {
                Ok(_) => {
                    loading_text.remove();
                }
                Err(e) => {
                    loading_text.set_inner_html(
                        "<p> The app has crashed. See the developer console for details. </p>",
                    );
                    panic!("Failed to start eframe: {e:?}");
                }
            }
        }
    });
}

#[cfg(test)]
mod test_cli_args {
    #[test]
    fn test_debug_animations_slowdown_argument_processing() {
        // Test the logic that processes the debug_animations_slowdown argument

        // Case 1: No flag provided (None)
        let result1 = match None as Option<Option<f32>> {
            Some(Some(factor)) => factor, // --debug-animations-slowdown=X
            Some(None) => 10.0,           // --debug-animations-slowdown (no value)
            None => 1.0,                  // not specified
        };
        assert_eq!(result1, 1.0, "No flag should result in normal speed");

        // Case 2: Flag provided without value (Some(None))
        let result2 = match Some(None) as Option<Option<f32>> {
            Some(Some(factor)) => factor, // --debug-animations-slowdown=X
            Some(None) => 10.0,           // --debug-animations-slowdown (no value)
            None => 1.0,                  // not specified
        };
        assert_eq!(
            result2, 10.0,
            "Flag without value should result in 10x slowdown"
        );

        // Case 3: Flag provided with custom value (Some(Some(5.0)))
        let result3 = match Some(Some(5.0f32)) as Option<Option<f32>> {
            Some(Some(factor)) => factor, // --debug-animations-slowdown=X
            Some(None) => 10.0,           // --debug-animations-slowdown (no value)
            None => 1.0,                  // not specified
        };
        assert_eq!(result3, 5.0, "Flag with custom value should use that value");
    }
}

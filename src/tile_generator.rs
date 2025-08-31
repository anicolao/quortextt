use flows::game::{Direction, PlacedTile, Rotation, TileType};
use std::f32::consts::PI;

// Simple SVG generation for tile visualization
struct SvgGenerator {
    svg: String,
    width: f32,
    height: f32,
}

impl SvgGenerator {
    fn new(width: f32, height: f32) -> Self {
        let header = format!(
            r#"<svg width="{}" height="{}" xmlns="http://www.w3.org/2000/svg">"#,
            width, height
        );
        Self {
            svg: header,
            width,
            height,
        }
    }

    fn add_polygon(&mut self, points: &[(f32, f32)], stroke: &str, fill: &str) {
        let points_str = points
            .iter()
            .map(|(x, y)| format!("{},{}", x, y))
            .collect::<Vec<_>>()
            .join(" ");
        self.svg.push_str(&format!(
            r#"<polygon points="{}" stroke="{}" stroke-width="2" fill="{}"/>"#,
            points_str, stroke, fill
        ));
    }

    fn add_curve(
        &mut self,
        p1: (f32, f32),
        cp1: (f32, f32),
        cp2: (f32, f32),
        p2: (f32, f32),
        stroke: &str,
    ) {
        self.svg.push_str(&format!(
            r#"<path d="M {} {} C {} {}, {} {}, {} {}" stroke="{}" stroke-width="3" fill="none"/>"#,
            p1.0, p1.1, cp1.0, cp1.1, cp2.0, cp2.1, p2.0, p2.1, stroke
        ));
    }

    fn finish(mut self) -> String {
        self.svg.push_str("</svg>");
        self.svg
    }
}

fn hexagon_points(center: (f32, f32), radius: f32) -> Vec<(f32, f32)> {
    (0..6)
        .map(|i| {
            let angle = PI / 6.0 + (i as f32) * PI / 3.0; // Start from top-right, going clockwise
            (
                center.0 + radius * angle.cos(),
                center.1 + radius * angle.sin(),
            )
        })
        .collect()
}

fn direction_to_angle(direction: Direction) -> f32 {
    // Map directions to angles, starting from SouthWest=0 and going counter-clockwise
    // SouthWest = 240°, West = 180°, NorthWest = 120°, NorthEast = 60°, East = 0°, SouthEast = 300°
    let base_angles = [240.0, 180.0, 120.0, 60.0, 0.0, 300.0];
    base_angles[direction as usize] * PI / 180.0
}

fn get_edge_position(center: (f32, f32), radius: f32, direction: Direction) -> (f32, f32) {
    let angle = direction_to_angle(direction);
    (
        center.0 + radius * 0.8 * angle.cos(),
        center.1 + radius * 0.8 * angle.sin(),
    )
}

fn generate_tile_svg(tile_type: TileType, rotation: Rotation) -> String {
    let size = 200.0;
    let center = (size / 2.0, size / 2.0);
    let radius = 70.0;

    let mut svg = SvgGenerator::new(size, size);

    // Draw hexagon outline
    let hex_points = hexagon_points(center, radius);
    svg.add_polygon(&hex_points, "#666666", "none");

    // Draw direction labels
    let directions = [
        (Direction::SouthWest, "SW(0)"),
        (Direction::West, "W(1)"),
        (Direction::NorthWest, "NW(2)"),
        (Direction::NorthEast, "NE(3)"),
        (Direction::East, "E(4)"),
        (Direction::SouthEast, "SE(5)"),
    ];

    // Add direction labels
    for (direction, label) in &directions {
        let angle = direction_to_angle(*direction);
        let label_pos = (
            center.0 + (radius + 25.0) * angle.cos(),
            center.1 + (radius + 25.0) * angle.sin(),
        );
        svg.svg.push_str(&format!(
            r#"<text x="{}" y="{}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="gray">{}</text>"#,
            label_pos.0, label_pos.1, label
        ));
    }

    // Draw flows
    let placed_tile = PlacedTile::new(tile_type, rotation);
    let flows = placed_tile.all_flows();

    for (d1, d2) in flows {
        let p1 = get_edge_position(center, radius, d1);
        let p2 = get_edge_position(center, radius, d2);

        // Create control points for a curved path
        let cp1 = (
            center.0 + (p1.0 - center.0) * 0.3,
            center.1 + (p1.1 - center.1) * 0.3,
        );
        let cp2 = (
            center.0 + (p2.0 - center.0) * 0.3,
            center.1 + (p2.1 - center.1) * 0.3,
        );

        svg.add_curve(p1, cp1, cp2, p2, "#0066cc");
    }

    svg.finish()
}

fn main() {
    // Create assets directory
    std::fs::create_dir_all("assets/tiles").expect("Failed to create assets/tiles directory");

    let tile_types = [
        (TileType::NoSharps, "T0"),
        (TileType::OneSharp, "T1"),
        (TileType::TwoSharps, "T2"),
        (TileType::ThreeSharps, "T3"),
    ];

    for (tile_type, name) in &tile_types {
        let svg = generate_tile_svg(*tile_type, Rotation(0));
        let filename = format!("assets/tiles/{}_N.svg", name);
        std::fs::write(&filename, svg).expect(&format!("Failed to write {}", filename));
        println!("Generated {}", filename);
    }

    println!("\nTile flow analysis:");
    println!("Hexagonal directions:");
    println!("      NW(2)  NE(3)");
    println!("    W(1)       E(4)");
    println!("      SW(0)  SE(5)");
    println!();

    for (tile_type, name) in &tile_types {
        println!("{} ({:?}) flows:", name, tile_type);
        let placed_tile = PlacedTile::new(*tile_type, Rotation(0));
        let flows = placed_tile.all_flows();
        for (d1, d2) in flows {
            println!("  {:?} ↔ {:?}", d1, d2);
        }
        println!();
    }
}

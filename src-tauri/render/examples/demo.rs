// Opens the viewer with a cube and a checker picture, then closes it after a few seconds.
use gouache_render::*;
fn main() {
    let p: [f32; 24] = [-1.,-1.,1., 1.,-1.,1., 1.,1.,1., -1.,1.,1.,  -1.,-1.,-1., -1.,1.,-1., 1.,1.,-1., 1.,-1.,-1.];
    let n: Vec<f32> = p.chunks(3).flat_map(|v| { let l=(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]).sqrt(); [v[0]/l,v[1]/l,v[2]/l] }).collect();
    let uv = [0.,0., 1.,0., 1.,1., 0.,1., 0.,0., 0.,1., 1.,1., 1.,0.];
    let idx = vec![0,1,2,0,2,3, 4,5,6,4,6,7, 3,2,6,3,6,5, 0,4,7,0,7,1, 1,7,6,1,6,2, 0,3,5,0,5,4];
    let mut rgba = vec![]; for y in 0..64 { for x in 0..64 { let c = if (x/8+y/8)%2==0 {230} else {60}; rgba.extend([c, c/2+60, 200, 255]); } }
    let v = open(MeshData{positions:p.to_vec(),normals:n,uvs:uv.to_vec(),indices:idx}, Some(TexData{width:64,height:64,rgba}));
    match v {
        Ok(v) => { println!("OPEN {:?}", v.report); std::thread::sleep(std::time::Duration::from_secs(5)); v.close(); std::thread::sleep(std::time::Duration::from_millis(500)); println!("CLOSED"); }
        Err(e) => println!("ERROR {e}"),
    }
}

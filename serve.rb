require 'webrick'

port = 8080
dir  = File.dirname(__FILE__)

server = WEBrick::HTTPServer.new(
  Port:        port,
  DocumentRoot: dir,
  Logger:      WEBrick::Log.new(File::NULL),
  AccessLog:   []
)

# Godot web exports require these two headers for SharedArrayBuffer
server.mount_proc '/' do |req, res|
  path = File.join(dir, req.path == '/' ? 'index.html' : req.path)
  if File.file?(path)
    res['Cross-Origin-Opener-Policy']   = 'same-origin'
    res['Cross-Origin-Embedder-Policy'] = 'require-corp'
    res.body = File.binread(path)
    ext = File.extname(path)
    res.content_type = case ext
      when '.html' then 'text/html'
      when '.js'   then 'application/javascript'
      when '.wasm' then 'application/wasm'
      when '.pck'  then 'application/octet-stream'
      when '.png'  then 'image/png'
      else 'application/octet-stream'
    end
  else
    res.status = 404
    res.body   = 'Not found'
  end
end

puts "Game running at http://localhost:#{port} — press Ctrl+C to stop"
`open http://localhost:#{port}`

trap('INT') { server.shutdown }
server.start

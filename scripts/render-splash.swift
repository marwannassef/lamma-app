// Renders the splash image: the Lamma logo with the wordmark in English and Arabic underneath.
// Usage: swift scripts/render-splash.swift <logo.png> <latin.ttf> <arabic.ttf> <out.png>
import AppKit
import CoreText

let args = CommandLine.arguments
let (logoPath, latinFont, arabicFont, outPath) = (args[1], args[2], args[3], args[4])
for path in [latinFont, arabicFont] {
  CTFontManagerRegisterFontsForURL(URL(fileURLWithPath: path) as CFURL, .process, nil)
}
func font(_ path: String, _ size: CGFloat) -> NSFont {
  let desc = (CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: path) as CFURL) as! [CTFontDescriptor])[0]
  return CTFontCreateWithFontDescriptor(desc, size, nil) as NSFont
}

// Square, with everything inside the middle circle: Android 12+ masks the splash icon to a circle
// two thirds of its size.
let W: CGFloat = 1200, H: CGFloat = 1200
// Draw into an exact-pixel bitmap (NSImage.lockFocus would double it on a Retina Mac).
let rep = NSBitmapImageRep(
  bitmapDataPlanes: nil, pixelsWide: Int(W), pixelsHigh: Int(H), bitsPerSample: 8,
  samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
  bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = NSSize(width: W, height: H)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let logo = NSImage(contentsOfFile: logoPath)!
let side: CGFloat = 380
let top: CGFloat = 290
logo.draw(in: NSRect(x: (W - side) / 2, y: H - top - side, width: side, height: side))

func centered(_ text: String, _ f: NSFont, _ color: NSColor, top: CGFloat) {
  let attrs: [NSAttributedString.Key: Any] = [.font: f, .foregroundColor: color]
  let s = NSAttributedString(string: text, attributes: attrs)
  let size = s.size()
  s.draw(at: NSPoint(x: (W - size.width) / 2, y: H - top - size.height))
}
centered("Lamma", font(latinFont, 140), .white, top: top + side + 4)
centered("لمّة", font(arabicFont, 96), NSColor(red: 0.79, green: 0.71, blue: 1, alpha: 1), top: top + side + 178)
NSGraphicsContext.restoreGraphicsState()

try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: outPath))
print("wrote", outPath)

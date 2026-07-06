// SAR Track Viewer launcher: serve l'app embeddata su localhost e apre il browser.
// Niente installazione, niente file://: un doppio click e via.
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
)

//go:embed all:dist
var embedded embed.FS

func openBrowser(url string) {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "windows":
		cmd, args = "cmd", []string{"/c", "start", ""}
	case "darwin":
		cmd = "open"
	default:
		cmd = "xdg-open"
	}
	_ = exec.Command(cmd, append(args, url)...).Start()
}

func main() {
	app, err := fs.Sub(embedded, "dist")
	if err != nil {
		log.Fatal(err)
	}
	// porta effimera: nessun conflitto con altri servizi
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	url := fmt.Sprintf("http://%s/", ln.Addr().String())
	fmt.Println("SAR Track Viewer attivo su", url)
	fmt.Println("Chiudi questa finestra per fermarlo.")
	openBrowser(url)
	log.Fatal(http.Serve(ln, http.FileServer(http.FS(app))))
}

# Corbum releases

Downloads of the Pro/Business Docker images of Corbum products
(currently: **Fakturum**, e-invoicing API for XRechnung, ZUGFeRD and
Factur-X — https://corbum.de/fakturum.html).

The images are unlocked by a **license file**, which you get from one
of our sales partners (https://corbum.de/fakturum.html#partner).
Without a license they run as the Free version.

## Install

1. Download `fakturum-paid-<version>.tar.gz` from **Releases**.
2. Load it:

   ```bash
   docker load < fakturum-paid-<version>.tar.gz
   ```

3. Run it with your license file (use `-paid-arm64` on ARM machines):

   ```bash
   docker run -d -p 8080:8080 \
     -v /path/to/license.json:/app/license.json:ro \
     corbum-fakturum-api:<version>-paid-amd64
   ```

4. Check the active plan:

   ```bash
   curl http://localhost:8080/license/status
   ```

The API reference is built into every container: http://localhost:8080/docs

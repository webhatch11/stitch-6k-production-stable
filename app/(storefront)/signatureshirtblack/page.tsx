import { permanentRedirect } from "next/navigation";

// Legacy URL — redirect on the server instead of flashing a client page.
export default function SignatureShirtBlackRedirect() {
  permanentRedirect("/product/luxury-black-shirt");
}

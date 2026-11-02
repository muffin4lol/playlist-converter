import Link from "next/link";
export function OperatorContact() {
  const email = process.env.PUBLIC_SUPPORT_EMAIL;
  return (
    <p>
      Operated by Sahil Dhole.{" "}
      <Link href="/contact">
        Contact the operator for support or privacy requests
      </Link>
      .
      {email && (
        <>
          {" "}
          Support and privacy requests: <a href={`mailto:${email}`}>{email}</a>.
        </>
      )}
    </p>
  );
}

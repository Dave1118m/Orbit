using System;
using System.Net;
using System.Net.Mail;

class SmtpTest
{
    static void TestMain()
    {
        try
        {
            var client = new SmtpClient("smtp.gmail.com", 587)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential("mihrete99@gmail.com", "ouga jkti bidn ibun")
            };
            var msg = new MailMessage("mihrete99@gmail.com", "mihrete99@gmail.com", "Test", "Test body");
            client.Send(msg);
            Console.WriteLine("Success!");
        }
        catch(Exception e)
        {
            Console.WriteLine("Error: " + e.Message);
            if(e.InnerException != null) Console.WriteLine("Inner: " + e.InnerException.Message);
        }
    }
}
